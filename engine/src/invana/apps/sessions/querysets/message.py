"""Queries against ``session_messages``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.sessions.models import SessionMessage


class SessionMessageQuerySet:
    async def list_messages(self, session: AsyncSession, *, session_id: str) -> list[SessionMessage]:
        stmt = select(SessionMessage).where(SessionMessage.session_id == session_id).order_by(SessionMessage.seq)
        return list((await session.execute(stmt)).scalars().all())

    async def list_recent_messages(
        self, session: AsyncSession, *, session_id: str, before_seq: int, limit: int
    ) -> list[SessionMessage]:
        """The most recent messages with ``seq < before_seq``, oldest-first.

        Used to assemble the conversation-context window for NL translation
        (docs/for-developers/modules/ask/spec.md). ``before_seq`` is the current ask's user ``seq`` so the two
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

    async def add(self, session: AsyncSession, obj: SessionMessage) -> None:
        session.add(obj)
        await session.flush()
