"""Queries behind join tokens — ``personal_access_tokens`` rows narrowed to a pool."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.models import PersonalAccessToken, User
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select

#: The install's service account that holds every join token.
HOLDER = "workers"


class JoinTokenQuerySet:
    async def holder(self, session: AsyncSession) -> User | None:
        return (await session.execute(select(User).where(User.username == HOLDER))).scalar_one_or_none()

    async def add_user(self, session: AsyncSession, user: User) -> User:
        session.add(user)
        await session.flush()
        return user

    async def add(self, session: AsyncSession, token: PersonalAccessToken) -> PersonalAccessToken:
        session.add(token)
        await session.flush()
        return token

    async def get(self, session: AsyncSession, token_id: str) -> PersonalAccessToken | None:
        stmt = select(PersonalAccessToken).where(
            PersonalAccessToken.id == token_id, PersonalAccessToken.worker_pool_id.is_not(None)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def by_hash(self, session: AsyncSession, token_hash: str) -> PersonalAccessToken | None:
        stmt = select(PersonalAccessToken).where(
            PersonalAccessToken.token_hash == token_hash, PersonalAccessToken.worker_pool_id.is_not(None)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def names_like(self, session: AsyncSession, user_id: str, prefix: str) -> set[str]:
        stmt = select(PersonalAccessToken.name).where(
            PersonalAccessToken.user_id == user_id, PersonalAccessToken.name.like(f"{prefix}%")
        )
        return set((await session.execute(stmt)).scalars().all())

    async def claim_join(self, session: AsyncSession, token_id: str) -> bool:
        """Count one join against the token's cap, atomically; False when the cap is spent."""
        stmt = (
            update(PersonalAccessToken)
            .where(
                PersonalAccessToken.id == token_id,
                or_(PersonalAccessToken.join_cap.is_(None), PersonalAccessToken.joins < PersonalAccessToken.join_cap),
            )
            .values(joins=PersonalAccessToken.joins + 1)
            .returning(PersonalAccessToken.id)
        )
        return (await session.execute(stmt)).first() is not None

    async def page(
        self, session: AsyncSession, *, params: ListParams
    ) -> tuple[Sequence[PersonalAccessToken], PageInfo]:
        unfiltered = select(PersonalAccessToken).where(PersonalAccessToken.worker_pool_id.is_not(None))
        stmt = unfiltered
        if params.q:
            stmt = stmt.where(contains(params.q, PersonalAccessToken.name))
        if pools := params.values("pool_id"):
            stmt = stmt.where(PersonalAccessToken.worker_pool_id.in_(pools))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"created_at": PersonalAccessToken.created_at},
            id_column=PersonalAccessToken.id,
        )

    async def users_by_ids(self, session: AsyncSession, ids: Sequence[str]) -> dict[str, User]:
        if not ids:
            return {}
        rows = (await session.execute(select(User).where(User.id.in_(list(set(ids)))))).scalars().all()
        return {u.id: u for u in rows}
