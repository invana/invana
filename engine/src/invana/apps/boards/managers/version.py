"""Board version history (docs/for-developers/building-engine/boards-migration.md § 5.2).

Append-only: a version is written per meaningful change and never edited. No
audit event — versions at that rate would flood the log, and the history *is*
the record.

A drawn board's version and a declared board's **report** are the same row
(B6/B11). The client supplies the resolved document already merged, and the
server never re-merges it (B16).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.boards.models import Board, BoardVersion, pack_json
from invana.apps.boards.querysets import BoardVersionQuerySet
from invana.apps.boards.schemas import BoardVersionCreate
from invana.apps.sessions.querysets import SessionMessageQuerySet
from invana.core.errors import NotFoundError
from invana.core.settings import settings


class BoardVersionManager:
    board_versions_qs = BoardVersionQuerySet()

    # Cross-app reach into `sessions`, to check a message id resolves.
    _messages_qs = SessionMessageQuerySet()

    async def list_for_board(
        self,
        session: AsyncSession,
        *,
        board_id: str,
        limit: int,
        offset: int,
    ) -> tuple[list[BoardVersion], int]:
        items = await self.board_versions_qs.list_for_board(session, board_id=board_id, limit=limit, offset=offset)
        total = await self.board_versions_qs.count_for_board(session, board_id=board_id)
        return items, total

    async def get(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        board_id: str,
        graph_id: str,
    ) -> BoardVersion:
        version = await self.board_versions_qs.get(session, version_id)
        if version is None or version.board_id != board_id or version.graph_id != graph_id:
            raise NotFoundError("Board version not found.")
        return version

    async def create(
        self,
        session: AsyncSession,
        *,
        board: Board,
        user_id: str,
        payload: BoardVersionCreate,
    ) -> BoardVersion:
        """Append an immutable reading to the board's history.

        Provenance is best-effort: a ``message_id`` that does not resolve — a
        message in a private thread the caller cannot see, or a stale id — is
        **dropped, not fatal**. The version is still worth keeping.
        """
        message_id = payload.message_id
        if message_id is not None and await self._messages_qs.get_message(session, message_id) is None:
            message_id = None

        version = BoardVersion(
            board_id=board.id,
            graph_id=board.graph_id,
            created_by_id=user_id,
            message_id=message_id,
            cause=payload.cause,
            label=payload.label or "",
            snapshot_gz=pack_json(payload.snapshot),
            source_query=payload.source_query,
            styling=payload.styling or {},
            settings=payload.settings or {},
            banner=payload.banner,
            node_count=payload.node_count,
            edge_count=payload.edge_count,
        )
        await self.board_versions_qs.add(session, version)
        # Retention: keep only the newest N per board so keep-all growth is
        # bounded. INVANA_BOARD_HISTORY_LIMIT, 0 = keep all.
        await self.board_versions_qs.prune_for_board(session, board_id=board.id, keep=settings.board_history_limit)
        return version
