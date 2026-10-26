"""Queries behind ``worker_stats`` — the numbers the engine stored."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.models import WorkerStat


class WorkerStatQuerySet:
    async def exists(self, session: AsyncSession, pool_id: str, at: datetime) -> bool:
        return await session.get(WorkerStat, (pool_id, at)) is not None

    async def add(self, session: AsyncSession, stat: WorkerStat) -> WorkerStat:
        session.add(stat)
        await session.flush()
        return stat

    async def latest(self, session: AsyncSession) -> dict[str, WorkerStat]:
        """The newest row of every pool."""
        newest = select(WorkerStat.pool_id, func.max(WorkerStat.at).label("at")).group_by(WorkerStat.pool_id).subquery()
        stmt = select(WorkerStat).join(
            newest, (WorkerStat.pool_id == newest.c.pool_id) & (WorkerStat.at == newest.c.at)
        )
        return {s.pool_id: s for s in (await session.execute(stmt)).scalars().all()}

    async def ready_since(self, session: AsyncSession, pool_id: str, since: datetime) -> list[int]:
        stmt = select(WorkerStat.ready).where(WorkerStat.pool_id == pool_id, WorkerStat.at >= since)
        return [int(n) for n in (await session.execute(stmt)).scalars().all()]

    async def workers_series(self, session: AsyncSession, since: datetime) -> list[tuple[datetime, int]]:
        """Workers across every pool in each bucket since ``since``, oldest first."""
        stmt = (
            select(WorkerStat.at, func.sum(WorkerStat.workers))
            .where(WorkerStat.at >= since)
            .group_by(WorkerStat.at)
            .order_by(WorkerStat.at)
        )
        return [(at, int(n)) for at, n in (await session.execute(stmt)).all()]

    async def envelopes_since(self, session: AsyncSession, since: datetime) -> int:
        stmt = select(func.coalesce(func.sum(WorkerStat.envelopes), 0)).where(WorkerStat.at >= since)
        return int((await session.execute(stmt)).scalar_one())

    async def first_at(self, session: AsyncSession) -> datetime | None:
        return (await session.execute(select(func.min(WorkerStat.at)))).scalar_one()

    async def prune_before(self, session: AsyncSession, before: datetime) -> None:
        await session.execute(delete(WorkerStat).where(WorkerStat.at < before))
