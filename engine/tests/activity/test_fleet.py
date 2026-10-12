"""The fleet — the Agents Overview, Performance and who pins each model
(fleet-performance.md), against a real Postgres.

Four claims:

* Overview names what broke and what waits, counts a root with its steps'
  tokens and leaves eval runs out, and says *no month budget* as null;
* a degradation is named with the change that came before it, and a skill is
  read off the version its runs applied;
* too thin a baseline is not a degradation, and a Graph that ran nothing reads
  zeros and empties, never an error;
* pins group by address across agents, skill versions and eval judges.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import FleetManager
from invana.activity.models import Approval
from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph
from invana.apps.skills.models import Skill, SkillBinding, SkillVersion
from invana.apps.task_plans.models import TaskPlan
from invana.runtime.models import EvalSet, TaskRun

NOW = datetime(2026, 10, 13, 12, tzinfo=UTC)
fleet = FleetManager()


def _root(
    graph: Graph, agent: Agent | None, *, ago: timedelta, secs: float, status: str = "succeeded", **kw
) -> TaskRun:
    at = NOW - ago
    return TaskRun(
        graph_id=graph.id,
        agent_id=agent.id if agent else None,
        agent_version=1,
        status=status,
        queued_at=at,
        finished_at=at + timedelta(seconds=secs),
        **kw,
    )


async def _agent(session: AsyncSession, graph: Graph, name: str, **kw) -> Agent:
    row = Agent(graph_id=graph.id, name=name, created_at=NOW - timedelta(days=60), **kw)
    session.add(row)
    await session.flush()
    return row


async def test_overview_names_what_broke_and_what_waits(session: AsyncSession, graph: Graph, user) -> None:
    analyst = await _agent(session, graph, "Analyst")
    plan = TaskPlan(graph_id=graph.id, key="nightly-load", version=2, name="nightly-load")
    session.add(plan)
    await session.flush()
    ok = _root(graph, analyst, ago=timedelta(hours=5), secs=2, task_plan_id=plan.id, tokens_in=10, tokens_out=5)
    bad1 = _root(graph, analyst, ago=timedelta(hours=3), secs=2, status="failed", task_plan_id=plan.id)
    bad2 = _root(graph, analyst, ago=timedelta(hours=1), secs=2, status="failed", task_plan_id=plan.id)
    paused = _root(graph, analyst, ago=timedelta(minutes=30), secs=1, status="needs_input", body="Which quarter?")
    judged = _root(graph, analyst, ago=timedelta(minutes=20), secs=1, role="evaluate", tokens_in=999)
    session.add_all([ok, bad1, bad2, paused, judged])
    await session.flush()
    start = bad2.queued_at + timedelta(seconds=1)
    session.add_all(
        [
            TaskRun(graph_id=graph.id, parent_run_id=ok.id, step_key="load", status="succeeded", tokens_in=100),
            TaskRun(
                graph_id=graph.id,
                parent_run_id=bad2.id,
                step_key="load",
                status="failed",
                started_at=start,
                finished_at=start,
                error={"cause": "db_error", "message": "connection refused"},
            ),
            Approval(
                graph_id=graph.id,
                subject_kind="schedule",
                subject_id=plan.id,
                title="Monthly deals brief",
                deadline_at=NOW + timedelta(days=1),
            ),
        ]
    )
    await session.flush()

    view = await fleet.overview(session, graph_id=graph.id, now=NOW)

    assert view.tiles.runs_today == 4, "the eval run is not a run"
    assert view.tiles.failed_today == 2 and view.tiles.failed_latest == "nightly-load"
    assert view.tiles.waiting == 2 and view.tiles.waiting_latest == "Monthly deals brief"
    assert view.tiles.tokens_this_month == 115, "a root's tokens are its own and its steps'"
    assert view.tiles.max_tokens_month is None, "no agent declares a month budget"
    kinds = [(a.kind, a.title) for a in view.attention]
    assert kinds == [
        ("failing", "nightly-load failed 2 runs running"),
        ("waiting", "Monthly deals brief waits on a person"),
    ], "the agent repeating the plan's failure is not listed twice"
    assert view.attention[0].run_id == bad2.id
    assert view.attention[0].detail == "load · db_error · connection refused"
    assert len(view.daily) == 30 and view.daily[-1].date == "2026-10-13"
    assert (view.daily[-1].succeeded, view.daily[-1].failed) == (1, 2)


async def test_a_degradation_names_the_skill_version_before_it(session: AsyncSession, graph: Graph) -> None:
    analyst = await _agent(session, graph, "Analyst")
    skill = Skill(graph_id=graph.id, name="Route brief")
    plans = [TaskPlan(graph_id=graph.id, key=None, reusable=False) for _ in range(2)]
    session.add_all([skill, *plans])
    await session.flush()
    v1 = SkillVersion(skill_id=skill.id, version=1, plan_id=plans[0].id, published_at=NOW - timedelta(days=30))
    # Shipped inside the baseline, before the first slow run.
    v2 = SkillVersion(skill_id=skill.id, version=2, plan_id=plans[1].id, published_at=NOW - timedelta(days=2))
    session.add_all([v1, v2, SkillBinding(skill_id=skill.id, agent_id=analyst.id)])
    await session.flush()
    skill.current_version_id = v2.id

    roots = [_root(graph, analyst, ago=timedelta(days=6, hours=-i), secs=1.0) for i in range(6)]
    slow = [_root(graph, analyst, ago=timedelta(hours=10 - i), secs=5.0) for i in range(3)]
    session.add_all([*roots, *slow])
    await session.flush()
    session.add_all(
        [
            TaskRun(graph_id=graph.id, parent_run_id=r.id, status="succeeded", skills_applied=[v.id])
            for r, v in [*((r, v1) for r in roots), *((r, v2) for r in slow)]
        ]
    )
    await session.flush()

    perf = await fleet.performance(session, graph_id=graph.id, window=7, now=NOW)

    row = perf.agents[0]
    assert row.signal == "degraded" and row.runs == 9
    assert row.degradation.baseline_p95_ms == 1000.0 and row.degradation.p95_ms == 5000.0
    assert (row.degradation.change.record_kind, row.degradation.change.version) == ("skill", "2")
    assert perf.tiles.degraded == 1
    skill_row = perf.skills[0]
    assert skill_row.version == "2"
    assert skill_row.p95_ms == 5000.0 and skill_row.p95_prior_ms == 1000.0, "against its previous version"
    assert perf.trend.subject_id == analyst.id and len(perf.trend.points) == 7
    assert [m.label for m in perf.trend.marks] == ["Route brief v2"]

    overview = await fleet.overview(session, graph_id=graph.id, now=NOW)
    degraded = [a for a in overview.attention if a.kind == "degraded"]
    assert degraded[0].title == "Analyst got 400% slower"
    assert degraded[0].detail.startswith("p95 5.0s, up from 1.0s since Route brief v2")


async def test_a_thin_baseline_is_not_a_degradation_and_nothing_is_not_an_error(
    session: AsyncSession, graph: Graph
) -> None:
    empty = await fleet.performance(session, graph_id=graph.id, window=30, now=NOW)
    assert empty.agents == [] and empty.trend is None and empty.tiles.runs.value == 0
    view = await fleet.overview(session, graph_id=graph.id, now=NOW)
    assert view.attention == [] and view.changes == [] and view.tiles.p95_ms.value is None

    analyst = await _agent(session, graph, "Analyst", budget={"max_tokens_month": 1000})
    session.add_all(
        [_root(graph, analyst, ago=timedelta(days=3, hours=i), secs=1.0) for i in range(4)]
        + [_root(graph, analyst, ago=timedelta(hours=5 - i), secs=9.0) for i in range(3)]
    )
    await session.flush()
    perf = await fleet.performance(session, graph_id=graph.id, window=7, now=NOW)
    assert perf.agents[0].signal is None, "four baseline runs are too few to call it slow"
    view = await fleet.overview(session, graph_id=graph.id, now=NOW)
    assert view.tiles.max_tokens_month == 1000


async def test_pins_group_by_address(session: AsyncSession, graph: Graph) -> None:
    address = "llm/anthropic/claude-x"
    analyst = await _agent(session, graph, "Analyst", model_pin=address)
    skill = Skill(graph_id=graph.id, name="Route brief")
    plan = TaskPlan(graph_id=graph.id, key=None, reusable=False)
    session.add_all([skill, plan])
    await session.flush()
    version = SkillVersion(skill_id=skill.id, version=3, plan_id=plan.id, published_at=NOW, model_pin=address)
    session.add(version)
    await session.flush()
    skill.current_version_id = version.id
    session.add(EvalSet(graph_id=graph.id, subject_kind="agent", subject_id=analyst.id, judge_model_pin="llm/a/judge"))
    await session.flush()

    pins = await fleet.pins(session, graph_id=graph.id)

    by = {p.address: p for p in pins.items}
    assert set(by) == {address, "llm/a/judge"}
    assert [a.name for a in by[address].agents] == ["Analyst"]
    assert [(s.name, s.version) for s in by[address].skills] == [("Route brief", 3)]
    assert [j.name for j in by["llm/a/judge"].judges] == ["Analyst"]
