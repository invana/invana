"""Workers — every worker, one worker, drain.

docs/for-developers/modules/agents/features/workers.md. Any signed-in user
reads; only an install admin drains. A row's *running now* comes from the jobs
the queue says the worker holds, and its heartbeat age, uptime, CPU and step
numbers are computed here from stored columns at read time.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers import logs
from invana.apps.workers.managers.numbers import require_install_admin
from invana.apps.workers.managers.pools import PoolManager
from invana.apps.workers.models import Worker, WorkerChange, WorkerEvent, WorkerPool, WorkerState
from invana.apps.workers.querysets.events import WorkerEventQuerySet
from invana.apps.workers.querysets.queue import QueueQuerySet
from invana.apps.workers.querysets.workers import LIVE, WorkerQuerySet
from invana.apps.workers.schemas import (
    WORKER_LIST,
    CpuPoint,
    RunningStep,
    WorkerDetail,
    WorkerLogLine,
    WorkerPage,
    WorkerRow,
    WorkerStateCounts,
)
from invana.core.errors import NotFoundError
from invana.core.lists import ListParams, Page, applied_filters
from invana.core.settings import settings


def _seconds_since(moment: datetime | None, now: datetime) -> int | None:
    return None if moment is None else max(0, int((now - moment).total_seconds()))


class WorkerManager:
    """Stateless. The session is the first argument of every method."""

    workers = WorkerQuerySet()
    queue = QueueQuerySet()
    events = WorkerEventQuerySet()
    pools = PoolManager()

    async def resolve(self, session: AsyncSession, ref: str) -> Worker:
        worker = await self.workers.get_by_ref(session, ref)
        if worker is None:
            raise NotFoundError("No such worker.")
        return worker

    async def _running(self, session: AsyncSession, workers: Sequence[Worker]) -> dict[str, list[RunningStep]]:
        if settings.executor != "procrastinate":
            return {}
        by_queue_id = {w.queue_worker_id: w.id for w in workers if w.queue_worker_id is not None}
        doing = await self.queue.doing_of(session, list(by_queue_id))
        parsed = [(by_queue_id[w], json.loads(env), for_s) for w, _job, env, for_s in doing if env]
        runs = await self.queue.runs(session, sorted({p[1]["run_id"] for p in parsed}))
        out: dict[str, list[RunningStep]] = {}
        for worker_id, envelope, for_s in parsed:
            number, agent = runs.get(envelope["run_id"], (None, None))
            out.setdefault(worker_id, []).append(
                RunningStep(
                    function=str(envelope["task"]).partition("@")[0],
                    run_id=envelope["run_id"],
                    run_number=number,
                    agent=agent,
                    for_s=for_s,
                )
            )
        return out

    @staticmethod
    def _row(worker: Worker, pool: WorkerPool | None, running: list[RunningStep], now: datetime) -> WorkerRow:
        gone = worker.state in (WorkerState.lost.value, WorkerState.stopped.value)
        note = None
        if worker.state == WorkerState.lost.value:
            note = f"{worker.redelivered} steps redelivered"
        elif worker.state == WorkerState.starting.value:
            note = "waiting for its first heartbeat"
        elif worker.state == WorkerState.draining.value:
            note = f"finishing {worker.slots_busy} steps"
        return WorkerRow(
            id=worker.id,
            pool_id=worker.pool_id,
            pool=pool.name if pool else "",
            name=worker.name,
            node=worker.node,
            version=worker.version,
            labels=list(worker.labels or []),
            state=worker.state,
            running=running,
            slots=worker.slots,
            slots_busy=worker.slots_busy,
            heartbeat_s=_seconds_since(worker.last_heartbeat_at, now),
            cpu=None if worker.cpu is None else round(worker.cpu),
            up_s=None if gone else _seconds_since(worker.joined_at, now),
            note=note,
            joined_at=worker.joined_at,
            from_ip=worker.from_ip,
        )

    async def page(self, session: AsyncSession, *, params: ListParams) -> WorkerPage:
        found, info = await self.workers.page(session, params=params)
        now = datetime.now(UTC)
        pools = await self.pools.pools.by_ids(session, [w.pool_id for w in found])
        running = await self._running(session, found)
        items = [self._row(w, pools.get(w.pool_id), running.get(w.id, []), now) for w in found]
        scoped = params.one("pool_id")
        counts = await self.workers.state_counts(session, pool_id=scoped)
        page = Page[WorkerRow].of(items, info, applied_filters(params, WORKER_LIST))
        return WorkerPage(
            **page.model_dump(),
            counts=WorkerStateCounts(
                all=sum(counts.values()),
                busy=counts.get("busy", 0),
                idle=counts.get("idle", 0),
                starting=counts.get("starting", 0),
                lost=counts.get("lost", 0),
            ),
        )

    async def detail(self, session: AsyncSession, *, ref: str) -> WorkerDetail:
        worker = await self.resolve(session, ref)
        now = datetime.now(UTC)
        pool = await self.pools.pools.get(session, worker.pool_id)
        running = (await self._running(session, [worker])).get(worker.id, [])
        row = self._row(worker, pool, running, now)
        steps, failed, p95 = await self.queue.worker_facts(session, worker.id, now - timedelta(hours=1))
        return WorkerDetail(
            **row.model_dump(),
            steps_1h=steps,
            failed_1h=failed,
            p95_ms=p95,
            cpu_series=[CpuPoint(at=at, cpu=cpu) for at, cpu in logs.cpu_of(worker.id)],
            log=[WorkerLogLine(at=at, line=line) for at, line in logs.log_of(worker.id)],
        )

    async def _drain_one(self, session: AsyncSession, worker: Worker, actor) -> None:
        if worker.state not in LIVE or worker.state == WorkerState.draining.value:
            return
        worker.state = WorkerState.draining.value
        await self.events.add(
            session,
            WorkerEvent(
                pool_id=worker.pool_id,
                worker_id=worker.id,
                change=WorkerChange.drained.value,
                detail={"worker": worker.name},
                why=f"{worker.name} drained by {actor.username}",
                actor_id=actor.id,
            ),
        )

    async def drain(self, session: AsyncSession, *, ref: str, actor) -> None:
        """Stop a worker taking leases; it finishes what it holds, then reports ``stopped``."""
        require_install_admin(actor)
        await self._drain_one(session, await self.resolve(session, ref), actor)

    async def drain_pool(self, session: AsyncSession, *, ref: str, actor) -> None:
        require_install_admin(actor)
        pool = await self.pools.resolve(session, ref)
        for worker in await self.workers.live_in_pool(session, pool.id):
            await self._drain_one(session, worker, actor)
