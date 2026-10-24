"""A new agent is a draft until *Create agent*; a live one reads its Overview."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import AgentStatus
from invana.apps.agents.schemas import AgentCreate
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.runtime.managers import AgentOverviewManager
from invana.runtime.models import TaskRun

pytestmark = pytest.mark.asyncio

agents = AgentManager()


async def test_a_new_agent_is_a_draft_until_it_is_created(session: AsyncSession, graph: Graph, user: User):
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    assert agent.status == AgentStatus.draft.value

    await agents.make_live(session, agent=agent, actor=user)
    assert agent.status == AgentStatus.active.value

    with pytest.raises(ConflictError):
        await agents.make_live(session, agent=agent, actor=user)


async def test_a_draft_is_refused_work_like_a_paused_agent(session: AsyncSession, graph: Graph, user: User):
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    with pytest.raises(ConflictError) as caught:
        await agents.require_available(session, agent_id=agent.id, graph_id=graph.id)
    assert "draft" in str(caught.value.detail)
    with pytest.raises(ConflictError):
        await agents.set_status(session, agent=agent, status=AgentStatus.active, actor=user)


async def test_the_overview_has_a_row_for_every_day_even_with_no_runs(session: AsyncSession, graph: Graph, user: User):
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Idle"), actor=user)
    overview = await AgentOverviewManager().overview(session, agent=agent, days=7)
    assert len(overview.daily) == 7
    assert overview.daily[-1].date == datetime.now(UTC).date()
    assert all(d.runs == 0 and d.tokens == 0 for d in overview.daily)
    assert (overview.runs, overview.served_rate, overview.p95_ms, overview.recent) == (0, None, None, [])


async def test_the_overview_counts_root_runs_and_their_verdict(session: AsyncSession, graph: Graph, user: User):
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Busy"), actor=user)
    now = datetime.now(UTC)
    root = TaskRun(
        graph_id=graph.id,
        agent_id=agent.id,
        body="Which routes?",
        status="succeeded",
        outcome="answered",
        queued_at=now - timedelta(seconds=2),
        started_at=now - timedelta(seconds=2),
        finished_at=now,
        tokens_in=10,
        tokens_out=5,
    )
    session.add(root)
    await session.flush()
    session.add(
        TaskRun(graph_id=graph.id, parent_run_id=root.id, task_key="plan.verify", output={"served": "yes"}, tokens_in=1)
    )
    await session.flush()

    overview = await AgentOverviewManager().overview(session, agent=agent, days=30)
    assert (overview.runs, overview.served, overview.served_rate) == (1, 1, 1.0)
    assert overview.daily[-1].tokens == 16
    assert [(e.exit, e.runs, e.last_title) for e in overview.exits] == [("answered", 1, "Which routes?")]
    assert overview.recent[0].agents == 1
