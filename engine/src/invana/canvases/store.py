"""DB access layer for ``canvases`` rows (RFC-043)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.canvases.models import Canvas


class CanvasStore:
    async def list_for_graph(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        limit: int,
        offset: int,
        sort: str = "updated",
        include_archived: bool = False,
    ) -> list[Canvas]:
        # Shared graph-wide (RFC-043 Decision 3): scoped by graph only, NOT by
        # creator. Pinned float to the top; within each group, newest by the
        # chosen field.
        sort_col = Canvas.created_at if sort == "created" else Canvas.updated_at
        stmt = (
            select(Canvas)
            .where(Canvas.graph_id == graph_id)
            .order_by(Canvas.pinned.desc(), sort_col.desc())
            .limit(limit)
            .offset(offset)
        )
        if not include_archived:
            stmt = stmt.where(Canvas.archived.is_(False))
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_graph(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        include_archived: bool = False,
    ) -> int:
        stmt = select(func.count()).select_from(Canvas).where(Canvas.graph_id == graph_id)
        if not include_archived:
            stmt = stmt.where(Canvas.archived.is_(False))
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, canvas_id: str) -> Canvas | None:
        return (await session.execute(select(Canvas).where(Canvas.id == canvas_id))).scalar_one_or_none()

    async def get_by_session(self, session: AsyncSession, session_id: str) -> Canvas | None:
        return (await session.execute(select(Canvas).where(Canvas.session_id == session_id))).scalar_one_or_none()

    async def add(self, session: AsyncSession, obj: Canvas) -> None:
        session.add(obj)
        await session.flush()

    async def delete(self, session: AsyncSession, obj: Canvas) -> None:
        await session.delete(obj)
