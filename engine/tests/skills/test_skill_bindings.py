"""Binding — the one write path that offers a skill to an agent.

Four cases: the bind and its event, the two refusals, and what unbinding leaves
behind.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillBindingManager, SkillManager
from invana.apps.skills.schemas import SkillCreate
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events.models import Event

skills = SkillManager()
bindings = SkillBindingManager()


async def _agent(session: AsyncSession, graph: Graph, name: str = "Explorer") -> Agent:
    agent = Agent(graph_id=graph.id, name=name)
    session.add(agent)
    await session.flush()
    return agent


async def test_binding_offers_the_skill_and_records_who_did_it(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await skills.create(session, graph_id=graph.id, payload=SkillCreate(name="Escalate"), actor_id=user.id)
    agent = await _agent(session, graph)

    await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)
    await session.refresh(agent, ["bound_skills"])

    assert agent.skill_ids == [skill.id]
    event = (await session.execute(select(Event).where(Event.action == "agent.skill_bound"))).scalars().one()
    assert event.target_id == agent.id
    assert event.details["skill_name"] == "Escalate"
    assert event.details["agent_name"] == "Explorer"


async def test_binding_what_is_already_bound_is_refused(session: AsyncSession, graph: Graph, user: User) -> None:
    """Not a silent no-op: the caller believes it is changing the roster."""
    skill = await skills.create(session, graph_id=graph.id, payload=SkillCreate(name="Twice"), actor_id=user.id)
    agent = await _agent(session, graph)
    await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)

    with pytest.raises(ConflictError):
        await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)


async def test_unbinding_what_was_never_bound_reads_as_absent(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await skills.create(session, graph_id=graph.id, payload=SkillCreate(name="Unbound"), actor_id=user.id)
    agent = await _agent(session, graph)

    with pytest.raises(NotFoundError):
        await bindings.unbind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)


async def test_unbinding_leaves_the_skill_and_the_other_agents_alone(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """C4 · the journey — unbound here, still bound elsewhere."""
    skill = await skills.create(session, graph_id=graph.id, payload=SkillCreate(name="Shared"), actor_id=user.id)
    one = await _agent(session, graph, name="One")
    two = await _agent(session, graph, name="Two")
    for agent in (one, two):
        await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)

    await bindings.unbind(session, skill=skill, agent_id=one.id, agent_name=one.name, actor_id=user.id)
    await session.refresh(one, ["bound_skills"])
    await session.refresh(two, ["bound_skills"])

    assert one.skill_ids == []
    assert two.skill_ids == [skill.id]
    # The skill itself is untouched — unbinding is not deleting.
    assert await skills.get(session, skill_id=skill.id, graph_id=graph.id) is skill
