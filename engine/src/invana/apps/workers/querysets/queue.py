"""Reads over what a worker did and what waits for one.

Three sources, none of which this app owns:

| Source | Read through | Why not its model |
|---|---|---|
| ``procrastinate_jobs`` · ``_events`` | ``text()``, on the connection's search path | not an Invana model |
| ``envelope_outcomes`` | a table clause | the runtime owns the model and apps may not import it |
| ``task_runs`` · ``agents`` | table clauses | same |

An outcome a worker posted carries ``_worker`` (``id`` · ``pool`` · ``duration_ms``)
beside its tagged JSON; the numbers per worker and per pool come from it.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Float, Table, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.queues import PREFIX
from invana.core.models import Base


def _table(name: str) -> Table:
    """A runtime table from the shared metadata, so schema translation applies as it does to a model."""
    return Base.metadata.tables[name]


def _meta(key: str):
    return _table("envelope_outcomes").c.outcome["_worker"][key].as_string()


class QueueQuerySet:
    async def todo_by_queue(self, session: AsyncSession) -> list[tuple[str, int, int | None]]:
        """Each ``tools.*`` queue with jobs waiting: ``(queue, how many, seconds the oldest has waited)``."""
        sql = text(
            """
            SELECT j.queue_name, count(*) AS n,
                   extract(epoch FROM (now() - min(coalesce(e.at, j.scheduled_at, now())))) AS oldest
            FROM procrastinate_jobs j
            LEFT JOIN procrastinate_events e ON e.job_id = j.id AND e.type = 'deferred'
            WHERE j.status = 'todo' AND j.queue_name LIKE :prefix
            GROUP BY j.queue_name
            """
        )
        rows = (await session.execute(sql, {"prefix": f"{PREFIX}%"})).all()
        return [(name, int(n), None if oldest is None else max(0, int(oldest))) for name, n, oldest in rows]

    async def doing_of(
        self, session: AsyncSession, queue_worker_ids: list[int]
    ) -> list[tuple[int, int, str, int | None]]:
        """Jobs being run: ``(queue worker id, job id, envelope JSON, seconds running)``."""
        if not queue_worker_ids:
            return []
        sql = text(
            """
            SELECT j.worker_id, j.id, j.args->>'envelope',
                   (SELECT extract(epoch FROM (now() - max(e.at))) FROM procrastinate_events e
                    WHERE e.job_id = j.id AND e.type = 'started')
            FROM procrastinate_jobs j
            WHERE j.status = 'doing' AND j.worker_id = ANY(:ids)
            """
        )
        rows = (await session.execute(sql, {"ids": queue_worker_ids})).all()
        return [(int(w), int(i), env, None if s is None else max(0, int(s))) for w, i, env, s in rows]

    async def runs(self, session: AsyncSession, run_ids: list[str]) -> dict[str, tuple[int | None, str | None]]:
        """``run id -> (number, agent name)``."""
        if not run_ids:
            return {}
        runs, agents = _table("task_runs"), _table("agents")
        stmt = (
            select(runs.c.id, runs.c.number, agents.c.name)
            .select_from(runs.outerjoin(agents, agents.c.id == runs.c.agent_id))
            .where(runs.c.id.in_(run_ids))
        )
        return {rid: (number, agent) for rid, number, agent in (await session.execute(stmt)).all()}

    async def worker_facts(self, session: AsyncSession, worker_id: str, since: datetime) -> tuple[int, int, int | None]:
        """Steps a worker finished since ``since``, how many failed, and the p95 of their milliseconds."""
        outcomes = _table("envelope_outcomes")
        stmt = select(
            func.count(),
            func.count().filter(outcomes.c.outcome["kind"].as_string() == "failure"),
            func.percentile_cont(0.95).within_group(cast(_meta("duration_ms"), Float)),
        ).where(_meta("id") == worker_id, outcomes.c.created_at >= since)
        steps, failed, p95 = (await session.execute(stmt)).one()
        return int(steps), int(failed), None if p95 is None else int(p95)

    async def pool_finished(self, session: AsyncSession, pool_id: str, since: datetime, until: datetime) -> int:
        """Envelopes a pool's workers finished in ``[since, until)``."""
        outcomes = _table("envelope_outcomes")
        stmt = (
            select(func.count())
            .select_from(outcomes)
            .where(_meta("pool") == pool_id, outcomes.c.created_at >= since, outcomes.c.created_at < until)
        )
        return int((await session.execute(stmt)).scalar_one())
