"""DB access layer for ``sessions`` + ``session_messages`` rows."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.sessions.models import Session, SessionMessage


class SessionStore:
    async def list_for_user(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        limit: int,
        offset: int,
        sort: str = "updated",
        include_archived: bool = False,
    ) -> list[Session]:
        # Pinned always float to the top; within each group, newest by the
        # chosen field. `created` and anything else fall back to updated_at.
        sort_col = Session.created_at if sort == "created" else Session.updated_at
        stmt = (
            select(Session)
            .where(Session.graph_id == graph_id, Session.created_by_id == user_id)
            .order_by(Session.pinned.desc(), sort_col.desc())
            .limit(limit)
            .offset(offset)
        )
        if not include_archived:
            stmt = stmt.where(Session.archived.is_(False))
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_user(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        include_archived: bool = False,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(Session)
            .where(Session.graph_id == graph_id, Session.created_by_id == user_id)
        )
        if not include_archived:
            stmt = stmt.where(Session.archived.is_(False))
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, session_id: str) -> Session | None:
        stmt = select(Session).where(Session.id == session_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_messages(self, session: AsyncSession, *, session_id: str) -> list[SessionMessage]:
        stmt = select(SessionMessage).where(SessionMessage.session_id == session_id).order_by(SessionMessage.seq)
        return list((await session.execute(stmt)).scalars().all())

    async def list_recent_messages(
        self, session: AsyncSession, *, session_id: str, before_seq: int, limit: int
    ) -> list[SessionMessage]:
        """The most recent messages with ``seq < before_seq``, oldest-first.

        Used to assemble the conversation-context window for NL translation
        (RFC-036). ``before_seq`` is the current ask's user ``seq`` so the two
        just-inserted rows (the user message and the running placeholder) are
        excluded. Bounded by ``limit`` so long threads don't bloat the prompt.
        """
        stmt = (
            select(SessionMessage)
            .where(SessionMessage.session_id == session_id, SessionMessage.seq < before_seq)
            .order_by(SessionMessage.seq.desc())
            .limit(limit)
        )
        rows = list((await session.execute(stmt)).scalars().all())
        rows.reverse()  # back to ascending seq for chronological prompt order
        return rows

    async def get_message(self, session: AsyncSession, message_id: str) -> SessionMessage | None:
        stmt = select(SessionMessage).where(SessionMessage.id == message_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def next_seq(self, session: AsyncSession, *, session_id: str) -> int:
        """Next monotonic message sequence for a session (1-based)."""
        stmt = select(func.coalesce(func.max(SessionMessage.seq), 0)).where(SessionMessage.session_id == session_id)
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def add(self, session: AsyncSession, obj: Session | SessionMessage) -> None:
        session.add(obj)
        await session.flush()

    async def delete(self, session: AsyncSession, obj: Session) -> None:
        await session.delete(obj)
