"""The ``tools`` queue — tool steps run by ``invana worker``, outcomes read back by the API.

docs/for-developers/modules/platform/features/tool-plugins.md ·
docs/for-developers/modules/platform/features/distributed-execution.md.

Under ``INVANA_EXECUTOR=procrastinate`` a tool step leaves the interpreter as
a :class:`~invana.plugins.envelope.TaskEnvelope` on procrastinate's queue, which
lives in the app's own Postgres — no broker to run. Both halves are here:

| Side | Calls | Does |
|---|---|---|
| API process | :func:`defer` · :func:`await_outcome` | queues the envelope, polls ``envelope_outcomes`` for its key |
| ``invana worker`` | :func:`run_worker` → :func:`run_tool_envelope` | runs it rebuilt, records the outcome |
| ``invana migrate`` | :func:`apply_schema` | procrastinate's own tables, once |

**Outcomes come back through a row, not through procrastinate.** procrastinate
keeps no job result, so the worker writes the outcome — ``Out``, a failure or a
signal, in the tagged form of :func:`~invana.plugins.envelope.outcome_to_json`
— to ``envelope_outcomes``, keyed by the envelope's idempotency key. The API
process polls for it (250 ms, backing off to 1 s) and raises a failure or a
signal again exactly as the inline executor would have. The same row makes a
redelivery safe: a worker that finds the key already recorded returns without
running the task type a second time.

**A dead worker's jobs are retried by the other workers.** Each worker
heartbeats every 2 s; the reaper inside every ``invana worker`` looks once a
minute for jobs whose worker has been silent 10 s and retries them. A
redelivered envelope keeps its idempotency key.

**No worker running** is a timeout, not a hang: :func:`await_outcome` gives up
after the step's own limit plus the queue-wait allowance the caller passes and
raises ``transient · worker_unavailable`` naming ``invana worker``.

procrastinate and psycopg are the ``workers`` extra, so they are imported only
when the queue is used; a SQLite dev install never loads this module's
dependencies. Usage::

    from invana.plugins import queue

    await queue.defer(envelope)                                   # API
    out = await queue.await_outcome(envelope, session_factory=f, timeout_s=360)

    await queue.run_worker(runtime, concurrency=4)                # invana worker
    await queue.apply_schema()                                    # invana migrate
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from typing import TYPE_CHECKING, Any

from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.core.settings import settings
from invana.plugins.envelope import TaskEnvelope, outcome_from_json, outcome_to_json
from invana.plugins.sdk.context import Out
from invana.plugins.sdk.errors import TaskFailure
from invana.plugins.worker import run_envelope
from invana.runtime.querysets.plugins import EnvelopeOutcomeQuerySet

if TYPE_CHECKING:
    from procrastinate import App

    from invana.runtime.interpreter.loop import TaskRuntime

log = logging.getLogger(__name__)

QUEUE = "tools"
JOB = "run_tool_envelope"
HEARTBEAT_S = 2  # a worker's heartbeat
STALLED_AFTER_S = 10  # a job whose worker is silent this long is retried
REAP_EVERY_S = 60  # how often a worker's reaper looks
POLL_FIRST_S = 0.25  # the first outcome poll; doubles up to POLL_MAX_S
POLL_MAX_S = 1.0

_outcomes = EnvelopeOutcomeQuerySet()
_app: App | None = None
_opened = False
#: The runtime a worker rebuilds contexts from; set by :func:`run_worker`.
_worker_runtime: TaskRuntime | None = None


def conninfo(database_url: str | None = None) -> str:
    """The app database URL as libpq conninfo — the SQLAlchemy driver suffix dropped."""
    url = make_url(database_url or settings.database_url)
    query = dict(url.query)
    if "ssl" in query:  # asyncpg's name for libpq's sslmode
        query["sslmode"] = query.pop("ssl")
    return url.set(drivername="postgresql", query=query).render_as_string(hide_password=False)


def app() -> App:
    """The procrastinate app over the engine's database, built once per process."""
    global _app  # noqa: PLW0603 — one app per process, built on first use
    if _app is None:
        from procrastinate import App, PsycopgConnector

        built = App(connector=PsycopgConnector(conninfo=conninfo()))

        @built.task(name=JOB, queue=QUEUE)
        async def _run_tool_envelope(envelope: str) -> None:
            if _worker_runtime is None:
                raise RuntimeError("run_tool_envelope runs inside `invana worker` only")
            await run_tool_envelope(envelope, _worker_runtime)

        _app = built
    return _app


async def _open() -> App:
    """The app, its connection pool open — opened once and kept for the process."""
    global _opened  # noqa: PLW0603 — the pool lives as long as the process
    built = app()
    if not _opened:
        await built.open_async()
        _opened = True
    return built


async def defer(envelope: TaskEnvelope) -> None:
    """Queue one envelope on ``tools``; the caller must have committed what the worker will read."""
    built = await _open()
    await built.configure_task(JOB, queue=QUEUE).defer_async(envelope=envelope.to_json())


async def await_outcome(
    envelope: TaskEnvelope, *, session_factory: async_sessionmaker[AsyncSession], timeout_s: float
) -> Out:
    """Poll ``envelope_outcomes`` until a worker records this envelope's outcome.

    Returns the ``Out``, or raises what the worker raised. Past ``timeout_s``
    raises ``transient · worker_unavailable``: the envelope stays queued, but
    this step stops waiting for it.
    """
    deadline = time.monotonic() + timeout_s
    delay = POLL_FIRST_S
    while True:
        async with session_factory() as db:
            row = await _outcomes.get(db, envelope.idempotency_key)
            if row is not None:
                return outcome_from_json(row.outcome)
        left = deadline - time.monotonic()
        if left <= 0:
            raise TaskFailure(
                cls="transient",
                cause="worker_unavailable",
                message=(
                    f"No worker ran this step within {round(timeout_s)} s. "
                    "Start one on this install with: invana worker"
                ),
                short="no worker",
                evidence={"queue": QUEUE, "idempotency_key": envelope.idempotency_key},
            )
        await asyncio.sleep(min(delay, left))
        delay = min(delay * 2, POLL_MAX_S)


async def run_tool_envelope(wire: str, runtime: TaskRuntime) -> None:
    """The job a worker runs: one envelope, its outcome recorded once.

    A key already recorded is a redelivery and returns without running.
    Anything the task type raises is recorded in its wire form; only
    cancellation (the worker shutting down) escapes, so the job is retried.
    """
    from invana.runtime.executor import RebuiltContexts

    envelope = TaskEnvelope.from_json(wire)
    async with runtime._factory() as db:
        if await _outcomes.get(db, envelope.idempotency_key) is not None:
            return
    result: Out | BaseException
    try:
        result = await run_envelope(envelope, contexts=RebuiltContexts(runtime))
    except Exception as exc:
        result = exc
    async with runtime._factory() as db:
        try:
            await _outcomes.add(
                db, idempotency_key=envelope.idempotency_key, run_id=envelope.run_id, outcome=outcome_to_json(result)
            )
            await db.commit()
        except IntegrityError:
            # A redelivery raced this one and recorded first; its outcome stands.
            await db.rollback()


async def _reap(built: App) -> None:
    """Retry, once a minute, every job whose worker has been silent ``STALLED_AFTER_S``."""
    while True:
        await asyncio.sleep(REAP_EVERY_S)
        try:
            stalled = await built.job_manager.get_stalled_jobs(seconds_since_heartbeat=STALLED_AFTER_S)
            for job in stalled:
                await built.job_manager.retry_job(job)
            if stalled:
                log.warning("worker: retried %d stalled job(s) on %s", len(stalled), QUEUE)
        except Exception:
            log.exception("worker: the reaper failed; it tries again in %d s", REAP_EVERY_S)


async def run_worker(runtime: TaskRuntime, *, concurrency: int, wait: bool = True) -> None:
    """Run ``tools`` jobs with ``runtime`` until stopped — or, with ``wait=False``, until the queue is empty."""
    global _worker_runtime  # noqa: PLW0603 — the job reads the worker's runtime
    _worker_runtime = runtime
    built = await _open()
    reaper = asyncio.create_task(_reap(built), name="invana.worker.reaper")
    try:
        await built.run_worker_async(
            queues=[QUEUE],
            concurrency=concurrency,
            wait=wait,
            update_heartbeat_interval=HEARTBEAT_S,
            stalled_worker_timeout=STALLED_AFTER_S,
            delete_jobs="successful",
        )
    finally:
        reaper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reaper


async def apply_schema(database_url: str | None = None) -> bool:
    """Apply procrastinate's schema unless ``procrastinate_jobs`` exists; True when it applied.

    ``database_url`` names another database than the engine's — ``invana
    migrate --database-url`` — through a connection opened for this call only.
    """
    from procrastinate import App, PsycopgConnector

    built = App(connector=PsycopgConnector(conninfo=conninfo(database_url)))
    async with built.open_async():
        found: dict[str, Any] | None = await built.connector.execute_query_one_async(
            "SELECT to_regclass('procrastinate_jobs') IS NOT NULL AS present"
        )
        if found and found.get("present"):
            return False
        await built.schema_manager.apply_schema_async()
        return True


async def close() -> None:
    """Close the pool :func:`_open` kept — for a CLI command about to exit."""
    global _opened  # noqa: PLW0603
    if _opened and _app is not None:
        await _app.connector.close_async()
        _opened = False
