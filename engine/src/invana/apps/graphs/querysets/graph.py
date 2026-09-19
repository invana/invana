"""Queries against ``graphs`` — the container a person creates."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember, GraphStatus
from invana.core.auth.models import User


class GraphQuerySet:
    async def get(self, session: AsyncSession, graph_id: str) -> Graph | None:
        return await session.get(Graph, graph_id)

    async def get_by_slug(self, session: AsyncSession, *, owner_id: str, slug: str) -> Graph | None:
        stmt = select(Graph).where(Graph.created_by_id == owner_id, Graph.slug == slug)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_by_owner_username_and_slug(
        self, session: AsyncSession, *, owner_username: str, slug: str
    ) -> Graph | None:
        """The ``/u/{username}/{graphSlug}`` pair, resolved in one query.

        The CLI addresses graphs the same way the API does, so both go through
        here rather than each writing the join.
        """
        stmt = (
            select(Graph)
            .join(User, User.id == Graph.created_by_id)
            .where(User.username == owner_username, Graph.slug == slug)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_for_user(self, session: AsyncSession, *, user_id: str) -> list[Graph]:
        """Every Graph this person is a member of, newest first."""
        stmt = (
            select(Graph)
            .join(GraphMember, GraphMember.graph_id == Graph.id)
            .where(GraphMember.user_id == user_id, Graph.status != GraphStatus.deleted.value)
            .order_by(Graph.created_at.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    async def member_of(self, session: AsyncSession, *, user_id: str, include_archived: bool) -> list[Graph]:
        """Graphs this person belongs to, newest-touched first.

        Archiving never blocks access — an archived Graph is still reachable by
        URL and still queryable; this only decides what the list shows.
        """
        stmt = (
            select(Graph)
            .join(GraphMember, GraphMember.graph_id == Graph.id)
            .where(GraphMember.user_id == user_id)
            .order_by(Graph.updated_at.desc())
        )
        if not include_archived:
            stmt = stmt.where(Graph.status == GraphStatus.active)
        return list((await session.execute(stmt)).scalars().unique().all())

    async def member_count(self, session: AsyncSession, *, graph_id: str) -> int:
        stmt = select(func.count()).where(GraphMember.graph_id == graph_id)
        return int((await session.execute(stmt)).scalar_one())

    async def add(self, session: AsyncSession, graph: Graph) -> Graph:
        session.add(graph)
        await session.flush()
        return graph

    async def delete(self, session: AsyncSession, graph: Graph) -> None:
        await session.delete(graph)
