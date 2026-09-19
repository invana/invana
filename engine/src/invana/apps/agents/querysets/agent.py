"""Queries against ``agents``."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentLifetime, AgentStatus


class AgentQuerySet:
    async def get(self, session: AsyncSession, agent_id: str) -> Agent | None:
        return await session.get(Agent, agent_id)

    async def list_active_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[Agent]:
        """Every agent in the Graph that has not been retired."""
        stmt = select(Agent).where(Agent.graph_id == graph_id, Agent.status != AgentStatus.retired.value)
        return list((await session.execute(stmt)).scalars().all())

    async def names_by_ids(self, session: AsyncSession, ids: list[str]) -> dict[str, str]:
        if not ids:
            return {}
        rows = (await session.execute(select(Agent.id, Agent.name).where(Agent.id.in_(ids)))).all()
        return dict(rows)

    async def list_for_graph(
        self,
        session: AsyncSession,
        graph_id: str,
        *,
        include_ephemeral: bool = False,
        include_retired: bool = False,
    ) -> list[Agent]:
        """The roster. Ephemeral children are hidden by default (docs/for-developers/modules/work/spec.md)
        — they are still fully present in lineage and the trace."""
        stmt = select(Agent).where(Agent.graph_id == graph_id)
        if not include_ephemeral:
            stmt = stmt.where(Agent.lifetime == AgentLifetime.persistent.value)
        if not include_retired:
            stmt = stmt.where(Agent.status != AgentStatus.retired.value)
        return list((await session.execute(stmt.order_by(Agent.name))).scalars().all())

    async def get_by_key(self, session: AsyncSession, *, graph_id: str, key: str) -> Agent | None:
        stmt = select(Agent).where(Agent.graph_id == graph_id, Agent.key == key)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def children(self, session: AsyncSession, agent_id: str) -> list[Agent]:
        stmt = select(Agent).where(Agent.parent_agent_id == agent_id).order_by(Agent.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def bound_to_skill(self, session: AsyncSession, *, graph_id: str, skill_id: str) -> list[Agent]:
        """Agents carrying a skill. ``skill_ids`` is a JSON array rather than a
        join table, so this filters in Python — the roster is tens of rows, and
        a JSON containment operator would not work on SQLite."""
        rows = await self.list_for_graph(session, graph_id, include_ephemeral=True, include_retired=True)
        return [a for a in rows if skill_id in (a.skill_ids or [])]

    async def add(self, session: AsyncSession, agent: Agent) -> Agent:
        session.add(agent)
        await session.flush()
        return agent

    async def delete(self, session: AsyncSession, agent: Agent) -> None:
        await session.delete(agent)
