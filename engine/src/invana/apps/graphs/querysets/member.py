"""Queries against ``graph_members`` — who may reach which Graph.

Membership is a Graph relation, not an identity one: `core/auth` proves who you
are, `apps/graphs` decides which Graph you may reach (migration-plan §2.1).
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import Text, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.apps.graphs.models import GraphMember
from invana.core.auth.models import User
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class GraphMemberQuerySet:
    async def get(self, session: AsyncSession, *, graph_id: str, user_id: str) -> GraphMember | None:
        stmt = select(GraphMember).where(
            GraphMember.graph_id == graph_id,
            GraphMember.user_id == user_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_by_username(self, session: AsyncSession, *, graph_id: str, username: str) -> GraphMember | None:
        stmt = (
            select(GraphMember)
            .join(User, User.id == GraphMember.user_id)
            .where(GraphMember.graph_id == graph_id, User.username == username.lower())
            .options(selectinload(GraphMember.user))
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[GraphMember]:
        stmt = (
            select(GraphMember)
            .join(User, User.id == GraphMember.user_id)
            .where(GraphMember.graph_id == graph_id)
            .options(selectinload(GraphMember.user))
            .order_by(User.username)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def page_for_graph(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[GraphMember], PageInfo]:
        """One page of the Graph's members, by username.

        The username and email live on ``users``, so the statement joins it and
        sorts and resumes on ``User.username``; the member row reads it back
        through its loaded ``user``. ``roles`` is a JSON list, matched as text
        on the quoted role name so one statement reads the same on SQLite and
        Postgres.
        """
        unfiltered = (
            select(GraphMember)
            .join(User, User.id == GraphMember.user_id)
            .where(GraphMember.graph_id == graph_id)
            .options(selectinload(GraphMember.user))
        )
        stmt = unfiltered
        if roles := params.values("role"):
            stmt = stmt.where(or_(*(cast(GraphMember.roles, Text).like(f'%"{r}"%') for r in roles)))
        if params.q:
            stmt = stmt.where(contains(params.q, User.username, User.email))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"username": User.username},
            id_column=GraphMember.user_id,
        )

    async def list_for_user(self, session: AsyncSession, *, user_id: str) -> list[GraphMember]:
        stmt = select(GraphMember).where(GraphMember.user_id == user_id)
        return list((await session.execute(stmt)).scalars().all())

    async def graph_ids_for_user(self, session: AsyncSession, *, user_id: str) -> list[str]:
        stmt = select(GraphMember.graph_id).where(GraphMember.user_id == user_id)
        return list((await session.execute(stmt)).scalars().all())
