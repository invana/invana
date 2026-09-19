"""Reading the roster seeds it, so a Graph older than agents grows them on being
looked at rather than in a data migration (`AgentManager.seed_agents`)."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.registry import SEEDED_AGENTS
from invana.apps.graphs.models import Graph

pytestmark = pytest.mark.asyncio


async def test_listing_an_unseeded_graph_seeds_it(session: AsyncSession, graph: Graph):
    agents = await AgentManager().list_agents(session, graph=graph)
    assert {a.key for a in agents} == {s.key for s in SEEDED_AGENTS}
    # Explorer is the fallback default, so a Graph can answer without anyone
    # authoring an agent.
    assert graph.default_agent_id is not None


async def test_listing_twice_does_not_duplicate_the_roster(session: AsyncSession, graph: Graph):
    first = await AgentManager().list_agents(session, graph=graph)
    second = await AgentManager().list_agents(session, graph=graph)
    assert [a.id for a in first] == [a.id for a in second]
