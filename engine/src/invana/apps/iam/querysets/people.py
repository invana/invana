"""Queries behind IAM's People page — members, their accounts and the tokens that reach a Graph."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.apps.graphs.models import GraphMember
from invana.core.auth.models import PersonalAccessToken, User


class PeopleQuerySet:
    async def members(self, session: AsyncSession, *, graph_id: str) -> list[GraphMember]:
        """Every member of the Graph with its account loaded, by username."""
        stmt = (
            select(GraphMember)
            .join(User, User.id == GraphMember.user_id)
            .where(GraphMember.graph_id == graph_id)
            .options(selectinload(GraphMember.user))
            .order_by(User.username)
            .execution_options(populate_existing=True)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def member(self, session: AsyncSession, *, graph_id: str, user_id: str) -> GraphMember | None:
        stmt = (
            select(GraphMember)
            .where(GraphMember.graph_id == graph_id, GraphMember.user_id == user_id)
            .options(selectinload(GraphMember.user))
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def usernames(self, session: AsyncSession, *, ids: Sequence[str | None]) -> dict[str, str]:
        wanted = [i for i in set(ids) if i]
        if not wanted:
            return {}
        stmt = select(User.id, User.username).where(User.id.in_(wanted))
        return dict((await session.execute(stmt)).all())

    async def users(self, session: AsyncSession, *, ids: Sequence[str]) -> dict[str, User]:
        if not ids:
            return {}
        stmt = select(User).where(User.id.in_(list(set(ids))))
        return {u.id: u for u in (await session.execute(stmt)).scalars().all()}

    async def username_taken(self, session: AsyncSession, *, username: str) -> bool:
        stmt = select(User.id).where(func.lower(User.username) == username.lower())
        return (await session.execute(stmt)).first() is not None

    async def add(self, session: AsyncSession, row: User | GraphMember) -> None:
        session.add(row)
        await session.flush()

    async def live_tokens(
        self, session: AsyncSession, *, graph_id: str, user_ids: Sequence[str], now: datetime
    ) -> dict[str, int]:
        """Per person, their tokens not revoked, not expired, and reaching this Graph."""
        if not user_ids:
            return {}
        stmt = (
            select(PersonalAccessToken.user_id, func.count())
            .where(
                PersonalAccessToken.user_id.in_(list(user_ids)),
                PersonalAccessToken.revoked_at.is_(None),
                or_(PersonalAccessToken.expires_at.is_(None), PersonalAccessToken.expires_at > now),
                or_(PersonalAccessToken.graph_id.is_(None), PersonalAccessToken.graph_id == graph_id),
            )
            .group_by(PersonalAccessToken.user_id)
        )
        return {u: int(n) for u, n in (await session.execute(stmt)).all()}
