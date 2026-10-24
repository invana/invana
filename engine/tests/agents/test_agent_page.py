"""A new agent is a draft until *Create agent*; a live one reads its Overview."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import AgentActsManager
from invana.activity.models import Schedule, ScheduleStatus
from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import AgentStatus
from invana.apps.agents.schemas import AgentCreate, LifecycleAct
from invana.apps.graphs.models import Graph
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.runtime.managers import AgentLifecycleManager, AgentOverviewManager
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


async def test_a_draft_is_discarded_and_an_agent_that_ran_is_not(session: AsyncSession, graph: Graph, user: User):
    lifecycle = AgentLifecycleManager()
    draft = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Scratch"), actor=user)
    await lifecycle.delete_agent(session, agent=draft, actor=user)
    assert await agents.agents_qs.get(session, draft.id) is None

    ran = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Ran"), actor=user)
    session.add(TaskRun(graph_id=graph.id, agent_id=ran.id, status="succeeded"))
    await session.flush()
    with pytest.raises(ConflictError):
        await lifecycle.delete_agent(session, agent=ran, actor=user)


async def test_retire_names_and_pauses_the_schedules_that_start_the_agent(
    session: AsyncSession, graph: Graph, user: User
):
    acts = AgentActsManager()
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Nightly"), actor=user)
    await agents.make_live(session, agent=agent, actor=user)
    schedule = Schedule(
        graph_id=graph.id, name="Route brief", agent_id=agent.id, instructions="Brief me", cron="0 2 * * *"
    )
    session.add(schedule)
    await session.flush()

    paused = await acts.preview(session, agent=agent, act=LifecycleAct.pause)
    assert [(i.kind, i.effect) for i in paused.items] == [("schedule", "refused")], "a pause leaves it on"
    retire = await acts.preview(session, agent=agent, act=LifecycleAct.retire)
    assert [(i.kind, i.title, i.effect) for i in retire.items] == [("schedule", "Route brief", "paused")]

    await acts.retire(session, agent=agent, actor=user, why="Replaced")
    assert schedule.status == ScheduleStatus.paused.value and schedule.next_fire_at is None
    assert (await acts.preview(session, agent=agent, act=LifecycleAct.retire)).items == []
