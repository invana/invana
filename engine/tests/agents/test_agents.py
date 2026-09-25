"""Reading the agents seeds them, so a Graph older than agents grows them on being
looked at rather than in a data migration (`AgentManager.seed_agents`)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.registry import SEEDED_AGENTS
from invana.apps.agents.schemas import AgentCreate, AgentRead
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.runtime.managers import AgentLifecycleManager
from invana.runtime.models import TaskRun

pytestmark = pytest.mark.asyncio


async def test_listing_an_unseeded_graph_seeds_it(session: AsyncSession, graph: Graph):
    agents = await AgentManager().list_agents(session, graph=graph)
    assert {a.key for a in agents} == {s.key for s in SEEDED_AGENTS}
    # Explorer is the fallback default, so a Graph can answer without anyone
    # authoring an agent.
    assert graph.default_agent_id is not None


async def test_listing_twice_does_not_duplicate_the_agents(session: AsyncSession, graph: Graph):
    first = await AgentManager().list_agents(session, graph=graph)
    second = await AgentManager().list_agents(session, graph=graph)
    assert [a.id for a in first] == [a.id for a in second]


async def _world(session: AsyncSession, graph: Graph, *, key: str = "eu-h1", name: str = "EU · H1 2026") -> Lens:
    lens = Lens(graph_id=graph.id, kind=LensKind.world.value, key=key, name=name)
    session.add(lens)
    await session.flush()
    return lens


async def test_an_agent_reads_back_its_own_guardrail_and_no_world(session: AsyncSession, graph: Graph, user: User):
    """An agent binds no world; its narrowing is a guardrail scoped to it
    (AG10 · AG26), and the read names it. Another agent's reads none."""
    manager = AgentManager()
    analyst = await manager.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    other = await manager.create_agent(session, graph=graph, payload=AgentCreate(name="Other"), actor=user)
    rail = Lens(
        graph_id=graph.id,
        kind=LensKind.guardrail.value,
        key="analyst-own",
        name="Nothing leaves",
        scope=f"agent:{analyst.id}",
    )
    session.add(rail)
    await session.flush()

    reads = {r.id: r for r in await manager.reads(session, [analyst, other])}
    assert (reads[analyst.id].guardrail_id, reads[analyst.id].guardrail_name) == (rail.id, "Nothing leaves")
    assert reads[other.id].guardrail_id is None
    assert "lens_id" not in AgentRead.model_fields


async def test_spend_this_month_is_a_grouped_read_and_absence_is_not_zero(
    session: AsyncSession, graph: Graph, user: User
):
    """C10 — the meter is a windowed `SUM(cost_usd)` per agent, and an agent
    whose runs cost nothing *knowable* is absent rather than zero (OB4)."""
    manager = AgentManager()
    priced = await manager.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    unpriced = await manager.create_agent(session, graph=graph, payload=AgentCreate(name="Subscriber"), actor=user)

    now = datetime.now(UTC)
    session.add_all(
        [
            TaskRun(graph_id=graph.id, agent_id=priced.id, started_at=now, cost_usd=1.25),
            TaskRun(graph_id=graph.id, agent_id=priced.id, started_at=now, cost_usd=0.59),
            # Last month's run, outside the window.
            TaskRun(
                graph_id=graph.id,
                agent_id=priced.id,
                started_at=now.replace(day=1) - timedelta(days=2),
                cost_usd=40.0,
            ),
            # A subscription call: nothing is known, so nothing is summed.
            TaskRun(graph_id=graph.id, agent_id=unpriced.id, started_at=now, cost_usd=None),
        ]
    )
    await session.flush()

    spend = await AgentLifecycleManager().spend_this_month(session, graph_id=graph.id)

    assert spend[priced.id] == pytest.approx(1.84)
    assert unpriced.id not in spend
