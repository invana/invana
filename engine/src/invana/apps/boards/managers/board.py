"""Board rules (docs/for-developers/building-engine/boards-migration.md).

Boards are **shared graph-wide** — ``get`` enforces graph scope only, never
creator. A ``data`` board is additionally created from a session the creator
owns, because sessions are private. Those two sentences are the whole access
model.

No ``fastapi``, no ``select()``, no ``commit()`` (migration-plan §4.1).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.boards.kinds import BOARD_KINDS, is_declared
from invana.apps.boards.models import Board
from invana.apps.boards.querysets import BoardQuerySet
from invana.apps.boards.schemas import BoardCreate, BoardUpdate
from invana.apps.sessions.querysets import SessionMessageQuerySet, SessionQuerySet
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class BoardManager:
    querysets = BoardQuerySet()

    # Cross-app reach into `sessions`, for the two facts a data board needs: the
    # session it snapshots, and that session's last query.
    _sessions = SessionQuerySet()
    _messages = SessionMessageQuerySet()

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
    ) -> tuple[list[Board], int]:
        items = await self.querysets.list_for_graph(
            session,
            graph_id=graph_id,
            limit=limit,
            offset=offset,
            sort=sort,
            include_archived=include_archived,
            kind=kind,
        )
        total = await self.querysets.count_for_graph(
            session, graph_id=graph_id, include_archived=include_archived, kind=kind
        )
        return items, total

    async def get(self, session: AsyncSession, *, board_id: str, graph_id: str) -> Board:
        board = await self.querysets.get(session, board_id)
        if board is None or board.graph_id != graph_id:
            raise NotFoundError("Board not found.")
        return board

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        payload: BoardCreate,
    ) -> Board:
        spec = BOARD_KINDS[payload.kind]

        sess = None
        if payload.session_id is not None:
            sess = await self._backing_session(
                session, session_id=payload.session_id, graph_id=graph_id, user_id=user_id
            )
            if await self.querysets.get_by_session(session, sess.id) is not None:
                raise ConflictError("This session already has a board.")
        elif payload.kind == "data":
            # The one kind that is born from a thread.
            raise ValidationError("A data board needs a backing session.")

        if spec.subject_required and not payload.subject_id:
            raise ValidationError(f"A {payload.kind} board needs a subject_id ({spec.subject}).")
        if payload.subject_id:
            existing = await self.querysets.get_by_subject(
                session, graph_id=graph_id, kind=payload.kind, subject_id=payload.subject_id
            )
            if existing is not None:
                raise ConflictError("A board of this kind already exists for that subject.")

        board = Board(
            graph_id=graph_id,
            kind=payload.kind,
            subject_id=payload.subject_id,
            session_id=sess.id if sess else None,
            created_by_id=user_id,
            title=(payload.title or (sess.title if sess else "") or f"Untitled {payload.kind}"),
            instructions=payload.instructions or "",
            settings=payload.settings or {},
            styling=payload.styling or {},
            view_state=payload.view_state or {},
            filters=payload.filters or {},
            snapshot=payload.snapshot or {},
            positions=payload.positions or {},
            source_query=payload.source_query
            or (await self._latest_source_query(session, session_id=sess.id) if sess else None),
        )
        await self.querysets.add(session, board)
        await self._emit(session, actions.BOARD_CREATE, board, user_id, {"kind": board.kind, "title": board.title})
        return board

    async def get_or_create_declared(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        kind: str,
        subject_id: str,
        title: str = "",
    ) -> Board:
        """The row behind a declared board, created on first use (B9).

        A live dashboard has no row — it is derived from its subject on every
        open. This is the one path that brings one into being, and it is called
        by the act that keeps something: saving a report. One call, so the
        client never asks whether a row exists.
        """
        if kind not in BOARD_KINDS:
            raise ValidationError(f"Unknown board kind: {kind}")
        if not is_declared(kind):
            raise ValidationError(f"{kind} is a drawn board — create it with a POST to /boards.")

        board = await self.querysets.get_by_subject(session, graph_id=graph_id, kind=kind, subject_id=subject_id)
        if board is not None:
            return board

        board = Board(
            graph_id=graph_id,
            kind=kind,
            subject_id=subject_id,
            created_by_id=user_id,
            title=title or f"{kind} {subject_id[:8]}",
        )
        await self.querysets.add(session, board)
        await self._emit(session, actions.BOARD_CREATE, board, user_id, {"kind": kind, "subject_id": subject_id})
        return board

    async def update(
        self,
        session: AsyncSession,
        *,
        board: Board,
        payload: BoardUpdate,
        actor_id: str,
    ) -> Board:
        """Apply a partial update — only the fields present in the payload.

        This is what keeps the lifetimes apart (B14): a recolour sends
        ``styling`` and nothing else is written, so a re-query replaces every
        node and keeps the colours.
        """
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(board, field, value)
        await session.flush()
        # Not the render blobs — just which fields moved.
        await self._emit(session, actions.BOARD_UPDATE, board, actor_id, {"fields": sorted(changes.keys())})
        return board

    async def delete(self, session: AsyncSession, *, board: Board, actor_id: str) -> None:
        board_id, graph_id, kind = board.id, board.graph_id, board.kind
        await self.querysets.delete(session, board)
        await emit_event(
            session,
            action=actions.BOARD_DELETE,
            target_kind=actions.TARGET_BOARD,
            target_id=board_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"kind": kind},
            trace_id=current_trace_id(),
        )

    async def _emit(self, session: AsyncSession, action: str, board: Board, actor_id: str, details: dict) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_BOARD,
            target_id=board.id,
            graph_id=board.graph_id,
            actor_id=actor_id,
            details=details,
            trace_id=current_trace_id(),
        )

    async def _backing_session(self, session: AsyncSession, *, session_id: str, graph_id: str, user_id: str):
        """The session a new data board snapshots.

        Three conditions, and they are the board rule rather than the session
        rule: it must exist, be in this Graph, and **belong to the caller** —
        sessions are private, so you can only snapshot your own.
        """
        sess = await self._sessions.get(session, session_id)
        if sess is None or sess.graph_id != graph_id or sess.created_by_id != user_id:
            raise NotFoundError("Session not found.")
        return sess

    async def _latest_source_query(self, session: AsyncSession, *, session_id: str) -> str | None:
        """The most recent message's ``source_query`` in the backing session."""
        messages = await self._messages.list_messages(session, session_id=session_id)
        for msg in reversed(messages):
            if msg.source_query:
                return msg.source_query
        return None
