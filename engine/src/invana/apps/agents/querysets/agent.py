"""Queries against ``agents``."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent, AgentLifetime, AgentStatus
from invana.core.lists import ListParams
from invana.core.lists.querysets import contains, page_of_select
from invana.core.lists.schemas import PageInfo


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
        """Every agent in the Graph, for code that reads them all — the fleet, a bind check."""
        stmt = select(Agent).where(Agent.graph_id == graph_id)
        if not include_ephemeral:
            stmt = stmt.where(Agent.lifetime == AgentLifetime.persistent.value)
        if not include_retired:
            stmt = stmt.where(Agent.status != AgentStatus.retired.value)
        return list((await session.execute(stmt.order_by(Agent.name))).scalars().all())

    async def page_for_graph(
        self, session: AsyncSession, graph_id: str, *, params: ListParams
    ) -> tuple[Sequence[Agent], PageInfo]:
        """One page of the Graph's agents.

        With no ``status`` filter a retired agent is left out, and with no
        ``ephemeral=shown`` a spawned helper is (docs/for-developers/modules/work/spec.md)
        — both are still fully present in lineage and the trace.
        """
        scoped = select(Agent).where(Agent.graph_id == graph_id)
        unfiltered = scoped.where(
            Agent.lifetime == AgentLifetime.persistent.value, Agent.status != AgentStatus.retired.value
        )
        stmt = scoped
        if "shown" not in params.values("ephemeral"):
            stmt = stmt.where(Agent.lifetime == AgentLifetime.persistent.value)
        if statuses := params.values("status"):
            stmt = stmt.where(Agent.status.in_(statuses))
        else:
            stmt = stmt.where(Agent.status != AgentStatus.retired.value)
        if kinds := params.values("kind"):
            stmt = stmt.where(Agent.kind.in_(kinds))
        if params.q:
            stmt = stmt.where(contains(params.q, Agent.name, Agent.key))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"name": Agent.name, "created_at": Agent.created_at, "updated_at": Agent.updated_at},
            id_column=Agent.id,
        )

    async def count_by_lifetime(self, session: AsyncSession, graph_id: str) -> dict[str, int]:
        """``{lifetime: n}`` over the Graph's agents that are not retired."""
        stmt = (
            select(Agent.lifetime, func.count())
            .where(Agent.graph_id == graph_id, Agent.status != AgentStatus.retired.value)
            .group_by(Agent.lifetime)
        )
        return {lifetime: int(n) for lifetime, n in (await session.execute(stmt)).all()}

    async def get_by_key(self, session: AsyncSession, *, graph_id: str, key: str) -> Agent | None:
        stmt = select(Agent).where(Agent.graph_id == graph_id, Agent.key == key)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def children(self, session: AsyncSession, agent_id: str) -> list[Agent]:
        stmt = select(Agent).where(Agent.parent_agent_id == agent_id).order_by(Agent.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def spawned_since(self, session: AsyncSession, *, parent_id: str, since: datetime) -> int:
        """Agents this one has spawned since ``since`` — the meter beside
        ``max_children`` on the Activity tab."""
        stmt = (
            select(func.count()).select_from(Agent).where(Agent.parent_agent_id == parent_id, Agent.created_at >= since)
        )
        return int((await session.execute(stmt)).scalar_one())

    async def by_ids(self, session: AsyncSession, *, graph_id: str, ids: list[str]) -> list[Agent]:
        """The named agents in one Graph, ordered by name.

        Scoped to the Graph even though the ids came from inside it: a queryset
        that trusts its input is one refactor away from leaking a row.
        """
        if not ids:
            return []
        stmt = select(Agent).where(Agent.graph_id == graph_id, Agent.id.in_(ids)).order_by(Agent.name)
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, agent: Agent) -> Agent:
        session.add(agent)
        await session.flush()
        return agent

    async def delete(self, session: AsyncSession, agent: Agent) -> None:
        await session.delete(agent)
