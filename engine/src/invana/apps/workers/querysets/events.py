"""Queries behind worker events."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.models import WorkerChange, WorkerEvent
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import page_of_select


class WorkerEventQuerySet:
    async def add(self, session: AsyncSession, event: WorkerEvent) -> WorkerEvent:
        session.add(event)
        await session.flush()
        return event

    async def page(self, session: AsyncSession, *, params: ListParams) -> tuple[Sequence[WorkerEvent], PageInfo]:
        unfiltered = select(WorkerEvent)
        stmt = unfiltered
        if pools := params.values("pool_id"):
            stmt = stmt.where(WorkerEvent.pool_id.in_(pools))
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"at": WorkerEvent.at}, id_column=WorkerEvent.id
        )

    async def since(self, session: AsyncSession, since: datetime, *, change: str | None = None) -> list[WorkerEvent]:
        stmt = select(WorkerEvent).where(WorkerEvent.at >= since).order_by(WorkerEvent.at.desc())
        if change:
            stmt = stmt.where(WorkerEvent.change == change)
        return list((await session.execute(stmt)).scalars().all())

    async def count_lost_since(self, session: AsyncSession, since: datetime) -> int:
        stmt = (
            select(func.count())
            .select_from(WorkerEvent)
            .where(WorkerEvent.change == WorkerChange.lost.value, WorkerEvent.at >= since)
        )
        return int((await session.execute(stmt)).scalar_one())
