"""The tool queue — tool steps wait on ``tools.<labels>``, outcomes are read back from a row.

docs/for-developers/modules/platform/features/tool-plugins.md ·
docs/for-developers/modules/platform/features/distributed-execution.md ·
docs/for-developers/modules/agents/features/workers.md.

Under ``INVANA_EXECUTOR=procrastinate`` a tool step leaves the interpreter as a
:class:`~invana.plugins.envelope.TaskEnvelope` on procrastinate's queue, which
lives in the app's own Postgres — no broker to run. The queue is named for the
step's resources (``tools.cpu``, ``tools.cpu+gpu``, see
:mod:`invana.apps.workers.queues`).

| Side | Calls | Does |
|---|---|---|
| API process | :func:`defer` · :func:`await_outcome` | queues the envelope, polls ``envelope_outcomes`` for its key |
| Worker gateway | :func:`job_manager` | hands jobs to workers that dialled in (:mod:`invana.plugins.gateway`) |
| ``invana migrate`` | :func:`apply_schema` | procrastinate's own tables, once |

A worker never reaches this database: it joins a pool over HTTPS and the
gateway fetches, heartbeats and finishes jobs for it.

**Outcomes come back through a row, not through procrastinate.** procrastinate
keeps no job result, so the gateway writes the outcome a worker posted — ``Out``,
a failure or a signal, in the tagged form of
:func:`~invana.plugins.envelope.outcome_to_json` — to ``envelope_outcomes``,
keyed by the envelope's idempotency key. The API process polls for it (250 ms,
backing off to 1 s) and raises a failure or a signal again exactly as the inline
executor would have. A key already recorded is a redelivery, and the first
outcome stands.

**No worker carrying the label** is a timeout, not a hang: :func:`await_outcome`
gives up after the step's own limit plus the queue-wait allowance the caller
passes and raises ``transient · worker_unavailable`` naming the label and the
command that adds a worker.

procrastinate and psycopg are the ``workers`` extra, so they are imported only
when the queue is used; a SQLite dev install never loads this module's
dependencies. Usage::

    from invana.plugins import queue

    await queue.defer(envelope, queue_name="tools.cpu")           # API
    out = await queue.await_outcome(envelope, queue_name="tools.cpu", session_factory=f, timeout_s=360)

    await queue.apply_schema()                                    # invana migrate
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Any

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.workers.queues import labels_of
from invana.core.settings import settings
from invana.plugins.envelope import TaskEnvelope, outcome_from_json
from invana.plugins.sdk.context import Out
from invana.plugins.sdk.errors import TaskFailure
from invana.runtime.querysets.plugins import EnvelopeOutcomeQuerySet

if TYPE_CHECKING:
    from procrastinate import App
    from procrastinate.manager import JobManager

log = logging.getLogger(__name__)

JOB = "run_tool_envelope"
POLL_FIRST_S = 0.25  # the first outcome poll; doubles up to POLL_MAX_S
POLL_MAX_S = 1.0

_outcomes = EnvelopeOutcomeQuerySet()
_app: App | None = None
_opened = False


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

        @built.task(name=JOB, queue="tools.cpu")
        async def _run_tool_envelope(envelope: str) -> None:
            raise RuntimeError("tool envelopes run in workers that joined over the gateway, never in procrastinate")

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


async def job_manager() -> JobManager:
    """procrastinate's job manager, for the gateway: register workers, fetch, retry and finish jobs."""
    return (await _open()).job_manager


async def defer(envelope: TaskEnvelope, *, queue_name: str) -> None:
    """Queue one envelope on ``queue_name``; the caller must have committed what the worker will read."""
    built = await _open()
    await built.configure_task(JOB, queue=queue_name).defer_async(envelope=envelope.to_json())


def _unavailable(envelope: TaskEnvelope, queue_name: str, timeout_s: float) -> TaskFailure:
    label = "+".join(sorted(labels_of(queue_name))) or queue_name
    return TaskFailure(
        cls="transient",
        cause="worker_unavailable",
        message=(
            f"No worker carrying '{label}' ran this step within {round(timeout_s)} s. "
            "Add one: invana worker --engine <engine url> --token <join token> --pool <pool>"
        ),
        short="no worker",
        evidence={"queue": queue_name, "label": label, "idempotency_key": envelope.idempotency_key},
    )


async def await_outcome(
    envelope: TaskEnvelope,
    *,
    queue_name: str,
    session_factory: async_sessionmaker[AsyncSession],
    timeout_s: float,
    artifacts: list[dict[str, Any]] | None = None,
) -> Out:
    """Poll ``envelope_outcomes`` until a worker records this envelope's outcome.

    Returns the ``Out``, or raises what the worker raised. The files the step
    read or wrote ride back with the outcome and are appended to ``artifacts``.
    Past ``timeout_s`` raises ``transient · worker_unavailable``: the envelope
    stays queued, but this step stops waiting for it.
    """
    deadline = time.monotonic() + timeout_s
    delay = POLL_FIRST_S
    while True:
        async with session_factory() as db:
            row = await _outcomes.get(db, envelope.idempotency_key)
            if row is not None:
                if artifacts is not None:
                    artifacts.extend(row.outcome.get("_artifacts") or [])
                return outcome_from_json(row.outcome)
        left = deadline - time.monotonic()
        if left <= 0:
            raise _unavailable(envelope, queue_name, timeout_s)
        await asyncio.sleep(min(delay, left))
        delay = min(delay * 2, POLL_MAX_S)


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
