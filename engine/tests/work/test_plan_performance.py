"""How a plan has behaved ([LB33 · LB34 · LB36](docs/for-developers/modules/workflows/features/the-library.md)).

Three claims:

* a step's numbers come from the attempts that **ran** — a retry that recovered
  is not a failure, and a step closed without starting was not reached;
* a skill that inlined the plan ran it too, is named as its caller, and joins
  the per-step table only through the steps its copies recorded;
* a plan that never ran says nothing rather than zero.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.models import Skill, SkillVersion
from invana.apps.task_plans.models import Task, TaskPlan
from invana.runtime.managers import PlanPerformanceManager
from invana.runtime.models import TaskRun

NOW = datetime(2026, 9, 26, 12, tzinfo=UTC)


async def _plan(session: AsyncSession, graph: Graph) -> TaskPlan:
    plan = TaskPlan(graph_id=graph.id, key="nl-single", version=2, reusable=True)
    session.add(plan)
    await session.flush()
    session.add_all(
        [
            Task(task_plan_id=plan.id, key="translate", step_key="translate_thought", ordinal=0),
            Task(task_plan_id=plan.id, key="execute", step_key="execute_graph_query", ordinal=1),
            Task(task_plan_id=plan.id, key="verify_result", step_key="verify_result", ordinal=2),
        ]
    )
    await session.flush()
    return plan


def _root(graph: Graph, *, status: str, ago: timedelta, **kw) -> TaskRun:
    at = NOW - ago
    return TaskRun(graph_id=graph.id, status=status, queued_at=at, finished_at=at + timedelta(seconds=10), **kw)


def _step(root: TaskRun, key: str, *, ms: int, status: str = "succeeded", attempt: int = 1, **kw) -> TaskRun:
    start = root.queued_at + timedelta(seconds=1)
    return TaskRun(
        graph_id=root.graph_id,
        parent_run_id=root.id,
        step_key=key,
        status=status,
        attempt=attempt,
        started_at=start,
        finished_at=start + timedelta(milliseconds=ms),
        **kw,
    )


@pytest.mark.asyncio
class TestPerformance:
    async def test_a_step_is_measured_on_what_ran(self, session: AsyncSession, graph: Graph):
        plan = await _plan(session, graph)
        ok = _root(graph, status="succeeded", ago=timedelta(days=1), plan_origin="template:nl-single@2")
        bad = _root(graph, status="failed", ago=timedelta(days=2), plan_origin="template:nl-single@2")
        session.add_all([ok, bad])
        await session.flush()
        session.add_all(
            [
                _step(ok, "translate", ms=100),
                # Retried and recovered: used the bound, did not fail.
                _step(ok, "execute", ms=20, status="failed", error={"cause": "db_error"}),
                _step(ok, "execute", ms=30, attempt=2),
                _step(ok, "verify_result", ms=5, output={"served": "yes"}),
                _step(bad, "translate", ms=300),
                _step(bad, "execute", ms=10, status="failed", attempt=3, error={"cause": "query_invalid"}),
                # Closed after the failure, never started: not reached.
                TaskRun(graph_id=graph.id, parent_run_id=bad.id, step_key="verify_result", status="failed"),
            ]
        )
        await session.flush()

        perf = await PlanPerformanceManager().performance(session, plan=plan, window=7, now=NOW)

        assert perf.tiles.runs.value == 2 and perf.tiles.failed.value == 1
        assert perf.tiles.served.value == 1.0, "of verified runs, not of all runs"
        steps = {s.step_key: s for s in perf.steps}
        assert [s.step_key for s in perf.steps] == ["translate", "execute", "verify_result"]
        assert steps["execute"].failed == 1 and steps["execute"].retried == 0.5
        assert steps["verify_result"].ran_in == 0.5 and steps["verify_result"].failed == 0
        assert [(f.step_key, f.cause, f.count) for f in perf.failures] == [("execute", "query_invalid", 1)]
        assert [(b.step_key, b.limit, b.used, b.exhausted) for b in perf.bounds] == [("execute", 3, 1, 1)]
        assert perf.slowest["translate"][0].run_id == bad.id

    async def test_a_skill_that_inlined_it_counts_through_the_steps_it_copied(
        self, session: AsyncSession, graph: Graph
    ):
        plan = await _plan(session, graph)
        recorded = TaskPlan(graph_id=graph.id, key=None, reusable=False)
        # Copied before a copy recorded its source: a caller, never a step.
        legacy = TaskPlan(graph_id=graph.id, key=None, reusable=False)
        skill = Skill(graph_id=graph.id, name="Escalate a late supplier")
        older = Skill(graph_id=graph.id, name="Brief the route desk")
        session.add_all([recorded, legacy, skill, older])
        await session.flush()
        session.add_all(
            [
                SkillVersion(skill_id=skill.id, version=1, plan_id=recorded.id),
                SkillVersion(skill_id=older.id, version=1, plan_id=legacy.id),
                Task(
                    task_plan_id=recorded.id,
                    key="nl_single_translate",
                    source_plan_key="nl-single@2",
                    source_step_key="translate",
                ),
                # The skill's own step, not the plan's.
                Task(task_plan_id=recorded.id, key="tell_desk"),
                Task(task_plan_id=legacy.id, key="nl_single_translate", source_plan_key="nl-single@2"),
            ]
        )
        run = _root(graph, status="succeeded", ago=timedelta(hours=3), task_plan_id=recorded.id)
        old = _root(graph, status="succeeded", ago=timedelta(hours=4), task_plan_id=legacy.id)
        session.add_all([run, old])
        await session.flush()
        session.add_all(
            [
                _step(run, "nl_single_translate", ms=50),
                _step(run, "tell_desk", ms=900),
                _step(old, "nl_single_translate", ms=70),
            ]
        )
        await session.flush()

        manager = PlanPerformanceManager()
        perf = await manager.performance(session, plan=plan, window=7, now=NOW)
        assert perf.tiles.runs.value == 2, "both skills ran the plan"
        steps = {s.step_key: s for s in perf.steps}
        assert steps["translate"].ran_in == 1.0, "the legacy copy is not matched by guess, nor counted as unreached"
        assert steps["translate"].p50_ms == 50, "matched on what the copy recorded"
        assert steps["translate"].share_of_work == 1.0, "the skill's own step is not the plan's work"

        page = await manager.runs(session, plan=plan, window=7, now=NOW)
        assert {(r.called_by.kind, r.called_by.name) for r in page.items} == {
            ("skill", "Escalate a late supplier"),
            ("skill", "Brief the route desk"),
        }
        assert (await manager.runs(session, plan=plan, window=7, called_by="session", now=NOW)).items == []

    async def test_a_question_answered_is_not_a_retry_and_rounds_are_a_bound(self, session: AsyncSession, graph: Graph):
        plan = await _plan(session, graph)
        answered = _root(graph, status="succeeded", ago=timedelta(days=1), plan_origin="template:nl-single@2")
        spent = _root(graph, status="succeeded", ago=timedelta(days=2), plan_origin="template:nl-single@2")
        session.add_all([answered, spent])
        await session.flush()
        rounds = {"clarifications": {"round": 1, "limit": 3}}
        session.add_all(
            [
                # Asked once, answered, went on: an attempt, not a retry.
                _step(answered, "translate", ms=10, status="needs_input", output=rounds),
                _step(answered, "translate", ms=40, attempt=2),
                # Asked until the agent's limit, then settled without an answer.
                _step(spent, "translate", ms=10, status="needs_input", output=rounds),
                _step(
                    spent,
                    "translate",
                    ms=10,
                    attempt=2,
                    output={"bound": "max_clarifications", "clarifications": {"round": 3, "limit": 3}},
                ),
            ]
        )
        await session.flush()

        perf = await PlanPerformanceManager().performance(session, plan=plan, window=7, now=NOW)

        assert {s.step_key: s for s in perf.steps}["translate"].retried == 0.0
        assert [(b.bound, b.limit, b.used, b.exhausted) for b in perf.bounds if b.step_key == "translate"] == [
            ("max_clarifications", 3, 2, 1)
        ]

    async def test_a_plan_that_never_ran_says_nothing_rather_than_zero(self, session: AsyncSession, graph: Graph):
        plan = await _plan(session, graph)
        old = _root(graph, status="succeeded", ago=timedelta(days=40), plan_origin="template:nl-single@2")
        session.add(old)
        await session.flush()

        perf = await PlanPerformanceManager().performance(session, plan=plan, window=7, now=NOW)

        assert perf.tiles.runs.value == 0 and perf.tiles.served.value is None
        assert perf.tiles.work_p50_ms.value is None
        assert [s.p50_ms for s in perf.steps] == [None, None, None]
        assert len(perf.daily) == 8 and not any(d.served or d.failed for d in perf.daily)
