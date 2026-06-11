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
    ) -> list[Session]:
        stmt = (
            select(Session)
            .where(Session.graph_id == graph_id, Session.created_by_id == user_id)
            .order_by(Session.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_user(self, session: AsyncSession, *, graph_id: str, user_id: str) -> int:
        stmt = (
            select(func.count())
            .select_from(Session)
            .where(Session.graph_id == graph_id, Session.created_by_id == user_id)
        )
        return int((await session.execute(stmt)).scalar_one())

    async def get(self, session: AsyncSession, session_id: str) -> Session | None:
        stmt = select(Session).where(Session.id == session_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_messages(self, session: AsyncSession, *, session_id: str) -> list[SessionMessage]:
        stmt = select(SessionMessage).where(SessionMessage.session_id == session_id).order_by(SessionMessage.seq)
        return list((await session.execute(stmt)).scalars().all())

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
