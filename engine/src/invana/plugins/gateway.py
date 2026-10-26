"""The engine side of a worker's dial-out loop, over procrastinate.

docs/for-developers/modules/agents/features/workers.md ·
docs/for-developers/modules/platform/features/distributed-execution.md.

A worker holds no database credential. It joins a pool over HTTPS, heartbeats
every 2 s, leases envelopes and posts outcomes; this module is what answers.
Each joined worker is a procrastinate worker row, so the jobs it holds are
fetched, heartbeated and finished under its id and procrastinate's own
stalled-job query finds a lost worker's jobs.

| Call | Does |
|---|---|
| :meth:`Gateway.join` | validates the join token, registers a queue worker, returns the worker's credential |
| :meth:`Gateway.heartbeat` | stamps the worker, rotates its credential hourly, tells it to drain |
| :meth:`Gateway.lease` | long-polls up to 20 s for jobs on the ``tools.<labels>`` queues its labels cover |
| :meth:`Gateway.outcome` | records the outcome once (a redelivery keeps the first) and finishes the job |
| :class:`GatewaySweep` | every 5 s loses silent workers and redelivers their jobs; every 30 s stores pool numbers |

The rules (who may join, what a heartbeat does) are the managers in
:mod:`invana.apps.workers.managers.gateway`; this module owns the queue and the
sessions. Every method opens its own short session — a lease waiting on the
queue holds no database connection while it sleeps.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.workers.managers.gateway import WorkerGatewayManager
from invana.apps.workers.managers.numbers import LOST_AFTER_S
from invana.apps.workers.managers.stats import WorkerStatsManager
from invana.apps.workers.models import Worker, WorkerState
from invana.apps.workers.querysets.workers import WorkerQuerySet
from invana.apps.workers.queues import covers
from invana.apps.workers.schemas import (
    HeartbeatIn,
    HeartbeatOut,
    JoinIn,
    JoinOut,
    Lease,
    LeaseIn,
    LeaseOut,
    OutcomeIn,
)
from invana.core.errors import ValidationError
from invana.core.settings import settings
from invana.plugins import queue
from invana.plugins.envelope import TaskEnvelope
from invana.runtime.querysets.plugins import EnvelopeOutcomeQuerySet

if TYPE_CHECKING:
    from procrastinate.manager import JobManager

log = logging.getLogger(__name__)

HEARTBEAT_S = 2
LEASE_WAIT_S = 20
LEASE_POLL_S = 0.5
SWEEP_EVERY_S = 5
STATS_EVERY_S = 30

_workers = WorkerQuerySet()
_outcomes = EnvelopeOutcomeQuerySet()
_rules = WorkerGatewayManager()


def enabled() -> bool:
    """The gateway runs under ``INVANA_EXECUTOR=procrastinate`` on Postgres."""
    return settings.executor == "procrastinate" and settings.database_url.startswith("postgresql")


class Gateway:
    """The worker routes' implementation. Cheap to build per request; it keeps no state."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._factory = session_factory

    @staticmethod
    def _require_enabled() -> None:
        if not enabled():
            raise ValidationError(
                "This install runs steps inline, so there is nothing for a worker to lease. "
                "Set INVANA_EXECUTOR=procrastinate on the engine (PostgreSQL) and restart it."
            )

    # ── join ──────────────────────────────────────────────────────────────────

    async def join(self, *, token: str, payload: JoinIn, from_ip: str | None) -> JoinOut:
        self._require_enabled()
        jobs = await queue.job_manager()
        async with self._factory() as session:
            worker, credential, pool = await _rules.admit(session, raw_token=token, payload=payload, from_ip=from_ip)
            worker.queue_worker_id = await jobs.register_worker()
            try:
                await session.commit()
            except BaseException:
                await jobs.unregister_worker(worker.queue_worker_id)
                raise
            return JoinOut(
                worker_id=worker.id,
                name=worker.name,
                pool=pool.name,
                labels=list(worker.labels),
                slots=worker.slots,
                credential=credential,
                heartbeat_s=HEARTBEAT_S,
                lease_wait_s=LEASE_WAIT_S,
            )

    # ── heartbeat ─────────────────────────────────────────────────────────────

    async def heartbeat(self, *, credential: str, payload: HeartbeatIn) -> HeartbeatOut:
        self._require_enabled()
        jobs = await queue.job_manager()
        async with self._factory() as session:
            worker = await _rules.authenticate(session, credential)
            out, revived = await _rules.beat(session, worker, payload)
            if worker.state == WorkerState.stopped.value:
                await self._unregister(jobs, worker)
            elif revived or worker.queue_worker_id is None:
                worker.queue_worker_id = await jobs.register_worker()
            else:
                await jobs.update_heartbeat(worker.queue_worker_id)
            await session.commit()
            return out

    @staticmethod
    async def _unregister(jobs: JobManager, worker: Worker) -> None:
        if worker.queue_worker_id is not None:
            with contextlib.suppress(Exception):
                await jobs.unregister_worker(worker.queue_worker_id)
            worker.queue_worker_id = None

    # ── lease ─────────────────────────────────────────────────────────────────

    async def lease(self, *, credential: str, payload: LeaseIn) -> LeaseOut:
        """Long-poll for jobs; an empty answer after ``LEASE_WAIT_S`` is the caller's ``204``."""
        self._require_enabled()
        jobs = await queue.job_manager()
        deadline = time.monotonic() + LEASE_WAIT_S
        while True:
            async with self._factory() as session:
                worker = await _rules.authenticate(session, credential)
                if worker.state not in (WorkerState.starting.value, WorkerState.busy.value, WorkerState.idle.value):
                    return LeaseOut(leases=[])
                if worker.queue_worker_id is None:
                    worker.queue_worker_id = await jobs.register_worker()
                    await session.commit()
                queue_worker_id, labels = worker.queue_worker_id, list(worker.labels or [])
            leases = await self._take(jobs, queue_worker_id, labels, payload.free)
            left = deadline - time.monotonic()
            if leases or left <= 0:
                return LeaseOut(leases=leases)
            await asyncio.sleep(min(LEASE_POLL_S, left))

    async def _take(self, jobs: JobManager, queue_worker_id: int, labels: list[str], free: int) -> list[Lease]:
        taken: list[Lease] = []
        while len(taken) < free:
            names = [q["name"] for q in await jobs.list_queues_async(status="todo") if covers(labels, q["name"])]
            if not names:
                break
            job = await jobs.fetch_job(queues=names, worker_id=queue_worker_id)
            if job is None:
                break
            wire = str(job.task_kwargs["envelope"])
            envelope = TaskEnvelope.from_json(wire)
            async with self._factory() as session:
                recorded = await _outcomes.get(session, envelope.idempotency_key) is not None
            if recorded:
                # A redelivery of a step whose outcome is already stored: close it, run nothing.
                await jobs.finish_job(job, _succeeded(), delete_job=True)
                continue
            taken.append(Lease(job_id=job.id, envelope=wire))
        return taken

    # ── outcome ───────────────────────────────────────────────────────────────

    async def outcome(self, *, credential: str, payload: OutcomeIn) -> None:
        self._require_enabled()
        jobs = await queue.job_manager()
        async with self._factory() as session:
            worker = await _rules.authenticate(session, credential)
            found = list(await jobs.list_jobs_async(id=payload.job_id))
            if not found:
                return  # finished and deleted by whoever got there first
            job = found[0]
            envelope = TaskEnvelope.from_json(str(job.task_kwargs["envelope"]))
            if envelope.idempotency_key != payload.idempotency_key:
                raise ValidationError("That outcome is not for the job it names.")
            body = {
                **payload.outcome,
                "_worker": {"id": worker.id, "pool": worker.pool_id, "duration_ms": payload.duration_ms},
                "_artifacts": payload.artifacts,
            }
            if await _outcomes.get(session, envelope.idempotency_key) is None:
                try:
                    await _outcomes.add(
                        session, idempotency_key=envelope.idempotency_key, run_id=envelope.run_id, outcome=body
                    )
                    await session.commit()
                except IntegrityError:
                    await session.rollback()  # a redelivery recorded first; its outcome stands
            if job.worker_id == worker.queue_worker_id and job.status == "doing":
                await jobs.finish_job(job, _succeeded(), delete_job=True)


def _succeeded():
    from procrastinate.jobs import Status  # noqa: PLC0415 — the `workers` extra is optional

    return Status.SUCCEEDED


class GatewaySweep:
    """Marks silent workers lost, redelivers their jobs, and stores the pool numbers.

    Started with the engine and a no-op unless the gateway is enabled. Every
    5 s: workers silent for 30 s become ``lost``, the jobs they held go back on
    their queue with the same arguments (so the same idempotency key) and a
    ``lost`` event says how many. Every 30 s: one ``worker_stats`` row a pool.
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._factory = session_factory
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if enabled() and self._task is None:
            self._task = asyncio.create_task(self._loop(), name="invana.gateway.sweep")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def _loop(self) -> None:
        last_stats = 0.0
        while True:
            try:
                await self.sweep_lost()
                if time.monotonic() - last_stats >= STATS_EVERY_S:
                    last_stats = time.monotonic()
                    await self.write_stats()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("gateway sweep failed; it tries again in %d s", SWEEP_EVERY_S)
            await asyncio.sleep(SWEEP_EVERY_S)

    async def sweep_lost(self, *, now: datetime | None = None) -> int:
        """Mark workers silent past the limit lost and redeliver their jobs; returns how many were lost."""
        now = now or datetime.now(UTC)
        jobs = await queue.job_manager()
        lost = 0
        async with self._factory() as session:
            for worker in await _workers.silent_since(session, now - timedelta(seconds=LOST_AFTER_S)):
                redelivered = 0
                if worker.queue_worker_id is not None:
                    for job in await jobs.list_jobs_async(worker_id=worker.queue_worker_id, status="doing"):
                        await jobs.retry_job(job)
                        redelivered += 1
                    await Gateway._unregister(jobs, worker)
                seen = worker.last_heartbeat_at or worker.joined_at
                await _rules.mark_lost(
                    session,
                    worker,
                    redelivered=redelivered,
                    silent_s=max(LOST_AFTER_S, int((now - seen).total_seconds())),
                )
                lost += 1
            await session.commit()
        return lost

    async def write_stats(self, *, now: datetime | None = None) -> int:
        """Store this 30 s bucket's row for every pool."""
        async with self._factory() as session:
            try:
                written = await WorkerStatsManager().record(session, now=now)
                await session.commit()
            except IntegrityError:
                await session.rollback()  # another engine process wrote the bucket first
                return 0
            return written
