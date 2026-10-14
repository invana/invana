"""An agent's instructions: a draft, a publish, and a rollback read off its events.

Positive: a draft changes nothing a run reads until it publishes as the next
version, and a rollback restores an earlier text as a new version. Negative:
publishing with no draft, rolling back over an open draft, and restoring the
text that is already current are refused.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.schemas import AgentCreate
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.core.events import actions
from invana.core.events.models import Event

agents = AgentManager()


async def test_a_draft_publishes_as_the_next_version_and_rolls_back_as_another(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    agent = await agents.create_agent(
        session, graph=graph, payload=AgentCreate(name="Analyst", instructions="Be brief."), actor=user
    )

    await agents.write_draft(session, agent=agent, instructions="Cite every figure.")
    assert agent.instructions == "Be brief." and agent.version == 1

    await agents.publish_instructions(session, agent=agent, actor=user, why="sources first")
    assert (agent.instructions, agent.instructions_draft, agent.version) == ("Cite every figure.", None, 2)

    await agents.rollback_instructions(session, agent=agent, version=1, actor=user, why="too slow")
    assert (agent.instructions, agent.version) == ("Be brief.", 3)
    restored = (
        (
            await session.execute(
                select(Event)
                .where(Event.target_id == agent.id, Event.action == actions.AGENT_UPDATE)
                .order_by(Event.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    assert restored.details["restored_from"] == 1 and restored.details["why"] == "too slow"


async def test_publish_and_rollback_refuse_what_they_cannot_do(session: AsyncSession, graph: Graph, user: User) -> None:
    agent = await agents.create_agent(
        session, graph=graph, payload=AgentCreate(name="Planner", instructions="Plan."), actor=user
    )

    with pytest.raises(ConflictError, match="no draft"):
        await agents.publish_instructions(session, agent=agent, actor=user)

    await agents.write_draft(session, agent=agent, instructions="Plan twice.")
    await agents.publish_instructions(session, agent=agent, actor=user)
    await agents.write_draft(session, agent=agent, instructions="Plan three times.")
    with pytest.raises(ConflictError, match="publish or discard"):
        await agents.rollback_instructions(session, agent=agent, version=1, actor=user)

    await agents.discard_draft(session, agent=agent)
    await agents.write_draft(session, agent=agent, instructions="Plan.")
    await agents.publish_instructions(session, agent=agent, actor=user)
    # v3 reads "Plan." again, so restoring v1 has nothing to restore.
    with pytest.raises(ConflictError, match="already current"):
        await agents.rollback_instructions(session, agent=agent, version=1, actor=user)
