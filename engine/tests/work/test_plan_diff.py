"""What changed between two versions of a plan ([LB37](docs/for-developers/modules/workflows/features/the-library.md)).

Two claims: a version names each step added, removed, moved and changed —
field by field — and each declared argument that changed; and v1 is compared
against nothing, which is not an empty diff.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.task_plans.models import Task, TaskPlan
from invana.runtime.managers import TaskPlanRunsManager

READ_ONLY = {"type": "bool", "default": True}


async def _version(session: AsyncSession, graph: Graph, version: int, args_schema: dict, rows: list[dict]) -> TaskPlan:
    plan = TaskPlan(graph_id=graph.id, key="escalate-core", version=version, reusable=True, args_schema=args_schema)
    session.add(plan)
    await session.flush()
    session.add_all([Task(task_plan_id=plan.id, ordinal=i, **row) for i, row in enumerate(rows)])
    await session.flush()
    return plan


@pytest.mark.asyncio
class TestPlanDiff:
    async def test_a_version_names_what_changed_step_by_step(self, session: AsyncSession, graph: Graph):
        await _version(
            session,
            graph,
            1,
            {"read_only": READ_ONLY},
            [
                {"key": "fetch", "step_key": "execute_graph_query", "args": {"read_only": True}},
                {"key": "rank", "step_key": "shape_for_canvas"},
                {"key": "draft_note", "step_key": "translate_thought"},
            ],
        )
        v2 = await _version(
            session,
            graph,
            2,
            {"read_only": READ_ONLY, "grace_days": {"type": "int", "default": 2}},
            [
                {"key": "fetch", "step_key": "execute_graph_query", "args": {"read_only": "${args.read_only}"}},
                {"key": "await_reply", "step_key": None, "form": "human"},
                {"key": "rank", "step_key": "shape_for_canvas"},
            ],
        )

        diff = await TaskPlanRunsManager().diff(session, workflow=v2)

        assert (diff.version, diff.against_version) == (2, 1)
        assert (diff.added, diff.removed, diff.moved, diff.unchanged) == (["await_reply"], ["draft_note"], [], ["rank"])
        assert [(c.step_key, [(f.field, f.before, f.after) for f in c.fields]) for c in diff.changed] == [
            ("fetch", [("args.read_only", True, "${args.read_only}")])
        ], "a changed argument, and an insertion before `rank` is not a move"
        assert [(a.name, a.change) for a in diff.arguments] == [("grace_days", "added")]
        assert diff.summary == "+await_reply · \N{MINUS SIGN}draft_note · fetch changed · argument grace_days added"

    async def test_the_first_version_is_compared_against_nothing(self, session: AsyncSession, graph: Graph):
        v1 = await _version(session, graph, 1, {}, [{"key": "fetch", "step_key": "execute_graph_query"}])

        diff = await TaskPlanRunsManager().diff(session, workflow=v1)

        assert diff.against_version is None and diff.summary == "the first version"
        assert diff.added == [] and diff.unchanged == [], "not an empty diff: nothing was compared"
