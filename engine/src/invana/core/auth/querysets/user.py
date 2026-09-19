"""Queries against ``users``."""

from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.models import User


class UserQuerySet:
    async def get(self, session: AsyncSession, user_id: str) -> User | None:
        return await session.get(User, user_id)

    async def get_by_email(self, session: AsyncSession, email: str) -> User | None:
        stmt = select(User).where(User.email == (email or "").strip().lower())
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_by_username_or_email(self, session: AsyncSession, ref: str) -> User | None:
        """How the CLI names a person — either identifier works."""
        stmt = select(User).where(or_(User.username == ref, User.email == ref))
        return (await session.execute(stmt)).scalar_one_or_none()

    async def usernames_by_ids(self, session: AsyncSession, ids: list[str]) -> dict[str, str]:
        if not ids:
            return {}
        rows = (await session.execute(select(User.id, User.username).where(User.id.in_(ids)))).all()
        return dict(rows)
