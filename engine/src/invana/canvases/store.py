"""DB access layer for ``canvases`` rows (RFC-043, RFC-047)."""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.canvases.models import Canvas, CanvasState


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


class CanvasStateStore:
    """DB access for the append-only ``canvas_states`` history (RFC-047)."""

    async def list_for_canvas(
        self,
        session: AsyncSession,
        *,
        canvas_id: str,
        limit: int,
        offset: int,
    ) -> list[CanvasState]:
        # Newest first — the timeline reads top-down from the latest state.
        stmt = (
            select(CanvasState)
            .where(CanvasState.canvas_id == canvas_id)
            .order_by(CanvasState.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_canvas(self, session: AsyncSession, *, canvas_id: str) -> int:
        stmt = select(func.count()).select_from(CanvasState).where(CanvasState.canvas_id == canvas_id)
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, state_id: str) -> CanvasState | None:
        return (await session.execute(select(CanvasState).where(CanvasState.id == state_id))).scalar_one_or_none()

    async def add(self, session: AsyncSession, obj: CanvasState) -> None:
        session.add(obj)
        await session.flush()

    async def prune_for_canvas(self, session: AsyncSession, *, canvas_id: str, keep: int) -> int:
        """Delete all but the newest ``keep`` states of a canvas (RFC-047 retention).

        A no-op when ``keep`` <= 0 (keep-all). Returns the number deleted.
        """
        if keep <= 0:
            return 0
        # Ids to keep: the newest `keep` by created_at (id as a stable tiebreak).
        keep_ids = (
            select(CanvasState.id)
            .where(CanvasState.canvas_id == canvas_id)
            .order_by(CanvasState.created_at.desc(), CanvasState.id.desc())
            .limit(keep)
        )
        result = await session.execute(
            delete(CanvasState)
            .where(
                CanvasState.canvas_id == canvas_id,
                CanvasState.id.not_in(keep_ids),
            )
            # Fire-and-forget bulk delete — don't try to sync in-memory ORM state
            # (the subquery criteria isn't Python-evaluable anyway).
            .execution_options(synchronize_session=False)
        )
        return int(result.rowcount or 0)
