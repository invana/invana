"""Reading the agents seeds them, so a Graph older than agents grows them on being
looked at rather than in a data migration (`AgentManager.seed_agents`)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.registry import SEEDED_AGENTS
from invana.apps.agents.schemas import AgentCreate, AgentRead, AgentUpdate
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.core.errors import ValidationError
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


async def test_an_agent_is_authored_into_a_world_and_reads_it_back(session: AsyncSession, graph: Graph, user: User):
    """The third bound, over the API it is drawn from (AG2 · A1).

    The *name* rides with the id because the list draws a chip per row.
    """
    world = await _world(session, graph)
    agent = await AgentManager().create_agent(
        session,
        graph=graph,
        payload=AgentCreate(name="Analyst", lens_id=world.id),
        actor=user,
    )
    read = AgentRead.model_validate(agent)
    assert (read.lens_id, read.lens_name) == (world.id, "EU · H1 2026")


async def test_a_guardrail_is_refused_as_an_agents_bound(session: AsyncSession, graph: Graph, user: User):
    """It is already in force on every run this agent opens, so binding one
    here would read as a second bound that changes nothing."""
    rail = Lens(graph_id=graph.id, kind=LensKind.guardrail.value, key="house", name="House rules", scope="graph")
    session.add(rail)
    await session.flush()

    with pytest.raises(ValidationError, match="guardrail"):
        await AgentManager().create_agent(
            session,
            graph=graph,
            payload=AgentCreate(name="Analyst", lens_id=rail.id),
            actor=user,
        )


async def test_omitting_the_lens_keeps_it_and_null_widens_to_everything(
    session: AsyncSession, graph: Graph, user: User
):
    """Set-ness, not None-ness: *Everything* is a bound somebody chose, and an
    update about something else must never widen an agent on the way past."""
    world = await _world(session, graph)
    manager = AgentManager()
    agent = await manager.create_agent(
        session, graph=graph, payload=AgentCreate(name="Analyst", lens_id=world.id), actor=user
    )

    await manager.update_agent(session, agent=agent, payload=AgentUpdate(description="still bounded"), actor=user)
    assert agent.lens_id == world.id

    await manager.update_agent(session, agent=agent, payload=AgentUpdate(lens_id=None), actor=user)
    assert agent.lens_id is None
    assert AgentRead.model_validate(agent).lens_name is None


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
