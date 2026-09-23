"""Queries against ``lenses``.

Two reads a surface wants are deliberately **not** here: how many runs used a
world, and which agents carry it. Both live above this band — runs are the
runtime's, and ``agents.lens_id`` is the agents app's, which already imports
this one. Govern must not import them back, so the edge composes them and hands
the evidence to :class:`~invana.apps.govern.managers.lens.LensManager`, where
the rule about it lives.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.models import Lens, LensKind


class LensQuerySet:
    async def list_for_graph(
        self,
        session: AsyncSession,
        graph_id: str,
        *,
        kind: str | None = None,
        include_unnamed: bool = False,
    ) -> list[Lens]:
        """The drawer's read.

        ``include_unnamed`` is off by default because an unnamed lens is private
        to the run it was made for — it is in nobody's list, and there is no
        share action to find
        ([WO1](docs/for-developers/modules/govern/features/worlds.md)).
        """
        stmt = select(Lens).where(Lens.graph_id == graph_id)
        if kind is not None:
            stmt = stmt.where(Lens.kind == kind)
        if not include_unnamed:
            stmt = stmt.where(Lens.key.is_not(None))
        return list((await session.execute(stmt.order_by(Lens.name, Lens.created_at))).scalars().all())

    async def get(self, session: AsyncSession, lens_id: str) -> Lens | None:
        return (await session.execute(select(Lens).where(Lens.id == lens_id))).scalar_one_or_none()

    async def get_by_key(self, session: AsyncSession, graph_id: str, key: str) -> Lens | None:
        stmt = select(Lens).where(Lens.graph_id == graph_id, Lens.key == key)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def guardrails_for_graph(self, session: AsyncSession, graph_id: str) -> list[Lens]:
        """Every Graph-scoped guardrail — in force on every run, whatever world it is in."""
        stmt = (
            select(Lens)
            .where(Lens.graph_id == graph_id, Lens.kind == LensKind.guardrail.value, Lens.scope == "graph")
            .order_by(Lens.created_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def guardrails_for_agent(self, session: AsyncSession, graph_id: str, agent_id: str) -> list[Lens]:
        """The guardrail pinned on one agent, if it has one. Bounds nest."""
        stmt = (
            select(Lens)
            .where(
                Lens.graph_id == graph_id,
                Lens.kind == LensKind.guardrail.value,
                Lens.scope == f"agent:{agent_id}",
            )
            .order_by(Lens.created_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def worlds_for_graph(self, session: AsyncSession, graph_id: str) -> list[Lens]:
        """Every *named* world — what a guardrail save has to revalidate."""
        return await self.list_for_graph(session, graph_id, kind=LensKind.world.value)

    async def add(self, session: AsyncSession, lens: Lens) -> Lens:
        session.add(lens)
        await session.flush()
        return lens

    async def delete(self, session: AsyncSession, lens: Lens) -> None:
        await session.delete(lens)
