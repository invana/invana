"""Queries behind worker pools."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.models import WorkerPool
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class PoolQuerySet:
    async def get(self, session: AsyncSession, pool_id: str) -> WorkerPool | None:
        return await session.get(WorkerPool, pool_id)

    async def get_by_name(self, session: AsyncSession, name: str) -> WorkerPool | None:
        return (await session.execute(select(WorkerPool).where(WorkerPool.name == name))).scalar_one_or_none()

    async def get_by_ref(self, session: AsyncSession, ref: str) -> WorkerPool | None:
        """A pool by id or by its install-wide name."""
        return await self.get(session, ref) or await self.get_by_name(session, ref)

    async def all(self, session: AsyncSession) -> list[WorkerPool]:
        return list((await session.execute(select(WorkerPool).order_by(WorkerPool.name))).scalars().all())

    async def by_ids(self, session: AsyncSession, ids: Sequence[str]) -> dict[str, WorkerPool]:
        if not ids:
            return {}
        rows = (await session.execute(select(WorkerPool).where(WorkerPool.id.in_(list(set(ids)))))).scalars().all()
        return {p.id: p for p in rows}

    async def page(self, session: AsyncSession, *, params: ListParams) -> tuple[Sequence[WorkerPool], PageInfo]:
        unfiltered = select(WorkerPool)
        stmt = unfiltered.where(contains(params.q, WorkerPool.name)) if params.q else unfiltered
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"name": WorkerPool.name, "created_at": WorkerPool.created_at},
            id_column=WorkerPool.id,
        )

    async def add(self, session: AsyncSession, pool: WorkerPool) -> WorkerPool:
        session.add(pool)
        await session.flush()
        return pool
