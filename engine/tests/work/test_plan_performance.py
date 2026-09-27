"""How a plan has behaved ([LB33 · LB34 · LB36](docs/for-developers/modules/workflows/features/the-library.md)).

Three claims:

* a step's numbers come from the attempts that **ran** — a retry that recovered
  is not a failure, and a step closed without starting was not reached;
* a skill that inlined the plan ran it too, and is named as its caller, but its
  copied rows stay out of the per-step table;
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

    async def test_a_skill_that_inlined_it_is_a_caller_but_not_a_step(self, session: AsyncSession, graph: Graph):
        plan = await _plan(session, graph)
        caller = TaskPlan(graph_id=graph.id, key=None, reusable=False)
        skill = Skill(graph_id=graph.id, name="Escalate a late supplier")
        session.add_all([caller, skill])
        await session.flush()
        session.add_all(
            [
                SkillVersion(skill_id=skill.id, version=1, plan_id=caller.id),
                Task(task_plan_id=caller.id, key="nl_single_translate", source_plan_key="nl-single@2"),
            ]
        )
        run = _root(graph, status="succeeded", ago=timedelta(hours=3), task_plan_id=caller.id)
        session.add(run)
        await session.flush()
        session.add(_step(run, "nl_single_translate", ms=50))
        await session.flush()

        manager = PlanPerformanceManager()
        perf = await manager.performance(session, plan=plan, window=7, now=NOW)
        assert perf.tiles.runs.value == 1
        assert all(s.ran_in is None for s in perf.steps), "a copied key is not matched by guess"

        page = await manager.runs(session, plan=plan, window=7, now=NOW)
        assert [(r.called_by.kind, r.called_by.name) for r in page.items] == [("skill", "Escalate a late supplier")]
        assert (await manager.runs(session, plan=plan, window=7, called_by="session", now=NOW)).items == []

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
