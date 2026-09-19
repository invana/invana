"""Queries against the append-only ``board_versions`` history."""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.boards.models import BoardVersion


class BoardVersionQuerySet:
    async def list_for_board(
        self,
        session: AsyncSession,
        *,
        board_id: str,
        limit: int,
        offset: int,
    ) -> list[BoardVersion]:
        # Newest first — the timeline reads top-down from the newest version.
        stmt = (
            select(BoardVersion)
            .where(BoardVersion.board_id == board_id)
            .order_by(BoardVersion.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_board(self, session: AsyncSession, *, board_id: str) -> int:
        stmt = select(func.count()).select_from(BoardVersion).where(BoardVersion.board_id == board_id)
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, version_id: str) -> BoardVersion | None:
        return (await session.execute(select(BoardVersion).where(BoardVersion.id == version_id))).scalar_one_or_none()

    async def add(self, session: AsyncSession, obj: BoardVersion) -> None:
        session.add(obj)
        await session.flush()

    async def prune_for_board(self, session: AsyncSession, *, board_id: str, keep: int) -> int:
        """Delete all but the newest ``keep`` versions of a board
        (docs/for-developers/building-engine/boards-migration.md retention).

        A no-op when ``keep`` <= 0 (keep-all). Returns the number deleted.
        """
        if keep <= 0:
            return 0
        # Ids to keep: the newest `keep` by created_at (id as a stable tiebreak).
        keep_ids = (
            select(BoardVersion.id)
            .where(BoardVersion.board_id == board_id)
            .order_by(BoardVersion.created_at.desc(), BoardVersion.id.desc())
            .limit(keep)
        )
        result = await session.execute(
            delete(BoardVersion)
            .where(
                BoardVersion.board_id == board_id,
                BoardVersion.id.not_in(keep_ids),
            )
            # Fire-and-forget bulk delete — don't try to sync in-memory ORM state
            # (the subquery criteria isn't Python-evaluable anyway).
            .execution_options(synchronize_session=False)
        )
        return int(result.rowcount or 0)
