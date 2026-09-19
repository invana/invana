"""Queries against ``boards``.

Shared graph-wide: scoped by graph only, never by creator."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.boards.models import Board


class BoardQuerySet:
    async def list_for_graph(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        limit: int,
        offset: int,
        sort: str = "updated",
        include_archived: bool = False,
        kind: str | None = None,
    ) -> list[Board]:
        # Shared graph-wide: scoped by graph only, NOT by creator. Pinned float
        # to the top; within each group, newest by the chosen field.
        sort_col = Board.created_at if sort == "created" else Board.updated_at
        stmt = (
            select(Board)
            .where(Board.graph_id == graph_id)
            .order_by(Board.pinned.desc(), sort_col.desc())
            .limit(limit)
            .offset(offset)
        )
        if kind is not None:
            stmt = stmt.where(Board.kind == kind)
        if not include_archived:
            stmt = stmt.where(Board.archived.is_(False))
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_graph(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        include_archived: bool = False,
        kind: str | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Board).where(Board.graph_id == graph_id)
        if kind is not None:
            stmt = stmt.where(Board.kind == kind)
        if not include_archived:
            stmt = stmt.where(Board.archived.is_(False))
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, board_id: str) -> Board | None:
        return (await session.execute(select(Board).where(Board.id == board_id))).scalar_one_or_none()

    async def get_by_session(self, session: AsyncSession, session_id: str) -> Board | None:
        return (await session.execute(select(Board).where(Board.session_id == session_id))).scalar_one_or_none()

    async def get_by_subject(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        kind: str,
        subject_id: str,
    ) -> Board | None:
        """The board a declared kind is identified by (B9).

        This is the lookup that makes a live dashboard need no row: its identity
        is computable, so the row is only ever fetched — or created — when
        something is kept.
        """
        stmt = select(Board).where(
            Board.graph_id == graph_id,
            Board.kind == kind,
            Board.subject_id == subject_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, obj: Board) -> None:
        session.add(obj)
        await session.flush()

    async def delete(self, session: AsyncSession, obj: Board) -> None:
        await session.delete(obj)
