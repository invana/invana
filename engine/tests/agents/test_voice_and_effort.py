"""The agent page's engine half — its voice, its effort, what it can do and what
it is using (author-an-agent.md AG15 · AG16 · AG17 · AG23 · soul.md · EB9)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent
from invana.apps.agents.schemas import AgentCreate, AgentUpdate
from invana.apps.graphs.models import Graph
from invana.apps.llm.voice import DEFAULT_VOICE, render_traits, voice_for
from invana.apps.sessions.models import Session as ChatSession
from invana.apps.sessions.querysets import SessionQuerySet
from invana.apps.skills.managers import SkillBindingManager, SkillManager
from invana.core.auth.models import User
from invana.core.errors import ValidationError
from invana.core.events.models import Event
from invana.runtime.managers import AgentCapabilitiesManager, AgentLifecycleManager, SkillDraftManager
from invana.runtime.managers.skill_seed import NAME as BUILTIN_NAME
from invana.runtime.models import RunStatus, TaskRun

pytestmark = pytest.mark.asyncio

agents = AgentManager()


async def _events(session: AsyncSession, action: str) -> list[Event]:
    return list((await session.execute(select(Event).where(Event.action == action))).scalars().all())


async def test_a_voice_edit_is_one_version_and_a_soul_set_event(session: AsyncSession, graph: Graph, user: User):
    """The soul and its dials are `agent.soul_set`; effort rides `agent.update`.
    One edit is one version, however many fields moved (SO C4 · AG16)."""
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    before = agent.version

    await agents.update_agent(
        session,
        agent=agent,
        payload=AgentUpdate(
            soul="Curious, a little nerdy about aviation.",
            soul_traits={"humour": "playful", "formality": "casual"},
            effort={"max_clarifications": 0},
        ),
        actor=user,
    )

    assert agent.version == before + 1
    soul_set = await _events(session, "agent.soul_set")
    assert len(soul_set) == 1
    assert soul_set[0].details["soul_traits"] == {"humour": "playful", "formality": "casual"}
    update = await _events(session, "agent.update")
    assert update[-1].details["changed"] == ["effort"]
    # 0 is a value — an agent that never asks — not a fall-through to the default.
    assert agent.effective_effort["max_clarifications"] == 0


@pytest.mark.parametrize(
    ("payload", "named"),
    [
        (AgentUpdate(soul_traits={"sarcasm": "on"}), "sarcasm"),
        (AgentUpdate(soul_traits={"humour": "dry"}), "dry"),
        (AgentUpdate(effort={"max_retries": 2}), "max_retries"),
    ],
)
async def test_an_unknown_dial_or_effort_key_is_refused_by_name(
    session: AsyncSession, graph: Graph, user: User, payload: AgentUpdate, named: str
):
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    with pytest.raises(ValidationError, match=named):
        await agents.update_agent(session, agent=agent, payload=payload, actor=user)
    assert agent.soul_traits == {}
    assert agent.effort == {}


async def test_effort_falls_back_to_where_it_lived_for_one_release():
    """`effort` wins; `workflow_spec` then `budget` answer where it is silent (EB9)."""
    agent = Agent(
        effort={"max_steps": 12},
        workflow_spec={"max_steps": 99, "max_replans": 0},
        budget={"max_replans": 5, "max_clarifications": 4},
    )
    assert agent.effective_effort == {"max_steps": 12, "max_replans": 0, "max_clarifications": 4}


async def test_the_voice_is_the_dials_then_the_soul_and_humour_is_off_when_it_went_wrong():
    assert voice_for("", {}).endswith(DEFAULT_VOICE)
    assert voice_for("I am the airways analyst.", {}).endswith("I am the airways analyst.")
    # AG17 — whatever the dial says.
    assert render_traits({"humour": "playful"}, went_wrong=True).startswith("Do not joke.")
    # Where the caller cannot know yet, the rule is stated to the model instead.
    assert "use no humour" in render_traits({"humour": "playful"})


async def test_a_skill_needing_a_callable_the_envelope_lacks_is_marked_on_both_tables(
    session: AsyncSession, graph: Graph, user: User
):
    """Needs come from the plan (AG15); a need the envelope lacks is marked on
    the skill, and an allowed callable nothing needs reads *nothing bound*."""
    reads = await SkillDraftManager().list_reads(session, graph_id=graph.id)
    builtin = await SkillManager().get(
        session, skill_id=next(r.id for r in reads if r.name == BUILTIN_NAME), graph_id=graph.id
    )
    agent = Agent(
        graph_id=graph.id,
        name="Narrow",
        workflow_spec={"entry": "understand", "allow": ["understand_intent", "create_task"]},
    )
    session.add(agent)
    await session.flush()
    # Bound without the check, to stand for a binding made before the envelope narrowed.
    await SkillBindingManager().bind(session, skill=builtin, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)
    await session.refresh(agent, ["bound_skills"])

    read = await AgentCapabilitiesManager().read(session, agent=agent)

    [row] = read.skills
    assert row.needs and row.version == builtin.current_version.version
    assert row.missing and row.missing == [k for k in row.needs if k not in {"understand_intent", "create_task"}]
    by_key = {c.step_key: c for c in read.callables}
    assert by_key["create_task"].needed_by == []
    assert by_key["create_task"].bound == "work_write"


async def test_meters_read_the_record_and_absence_is_not_zero(session: AsyncSession, graph: Graph, user: User):
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)
    lifecycle = AgentLifecycleManager()

    empty = await lifecycle.meters(session, agent=agent)
    assert empty.spend_this_month is None
    assert empty.running == 0 and empty.runs_this_month == 0

    now = datetime.now(UTC)
    session.add_all(
        [
            TaskRun(graph_id=graph.id, agent_id=agent.id, status=RunStatus.running.value, started_at=now, cost_usd=0.5),
            TaskRun(graph_id=graph.id, agent_id=agent.id, status=RunStatus.queued.value),
            ChatSession(graph_id=graph.id, agent_id=agent.id, created_by_id=user.id, title="t"),
        ]
    )
    await session.flush()

    meters = await lifecycle.meters(session, agent=agent)
    assert meters.spend_this_month == pytest.approx(0.5)
    assert (meters.running, meters.queued, meters.runs_this_month, meters.sessions) == (1, 1, 2, 1)
    assert meters.max_concurrent_runs == agent.effective_budget["max_concurrent_runs"]


async def test_sessions_filter_by_agent(session: AsyncSession, graph: Graph, user: User):
    one = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="One"), actor=user)
    two = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Two"), actor=user)
    session.add_all(
        [
            ChatSession(graph_id=graph.id, agent_id=one.id, created_by_id=user.id, title="a"),
            ChatSession(graph_id=graph.id, agent_id=two.id, created_by_id=user.id, title="b"),
        ]
    )
    await session.flush()

    rows = await SessionQuerySet().list_for_user(
        session, graph_id=graph.id, user_id=user.id, limit=10, offset=0, agent_id=one.id
    )
    assert [r.title for r in rows] == ["a"]
