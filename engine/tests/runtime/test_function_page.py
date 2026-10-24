"""A function's page — its contract, who names it, and its calls in this Graph
(docs/for-developers/modules/workflows/features/the-catalogue.md).

Real Postgres, no mocks: the numbers are read from ``task_runs`` rows written here.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.flows.models import Flow, Task
from invana.apps.graphs.models import Graph
from invana.apps.skills.models import Skill, SkillVersion
from invana.core.errors import NotFoundError
from invana.core.lists import ListParams
from invana.runtime.managers import CatalogueManager
from invana.runtime.models import RunRole, TaskRun

pytestmark = pytest.mark.asyncio

KEY = "graph.read.query"
catalogue = CatalogueManager()


def _step(graph: Graph, root: TaskRun, *, status: str, ago: timedelta, key: str = KEY) -> TaskRun:
    at = datetime.now(UTC) - ago
    return TaskRun(
        graph_id=graph.id,
        parent_run_id=root.id,
        task_key=key,
        status=status,
        queued_at=at,
        started_at=at,
        finished_at=at + timedelta(milliseconds=40),
        queue_ms=0,
        duration_ms=40,
    )


async def test_a_function_reads_its_plans_skills_and_calls_in_this_graph(session: AsyncSession, graph: Graph):
    plans = [Flow(graph_id=graph.id, key="ask-once", version=v, name=f"Ask once v{v}") for v in (1, 2)]
    skill_plan = Flow(graph_id=graph.id, key=None, reusable=False)
    session.add_all([*plans, skill_plan])
    await session.flush()
    session.add_all(Task(flow_id=p.id, key="execute", form="callable", step_key=KEY) for p in [*plans, skill_plan])
    skill = Skill(graph_id=graph.id, name="Route audit")
    session.add(skill)
    await session.flush()
    version = SkillVersion(skill_id=skill.id, version=4, plan_id=skill_plan.id)
    session.add(version)
    await session.flush()
    skill.current_version_id = version.id

    root = TaskRun(graph_id=graph.id, body="Which routes?", status="succeeded")
    replay = TaskRun(graph_id=graph.id, role=RunRole.evaluate.value, status="succeeded")
    session.add_all([root, replay])
    await session.flush()
    session.add_all(
        [
            _step(graph, root, status="succeeded", ago=timedelta(hours=2)),
            _step(graph, root, status="failed", ago=timedelta(hours=1)),
            _step(graph, root, status="succeeded", ago=timedelta(days=40)),
            _step(graph, root, status="succeeded", ago=timedelta(hours=1), key="graph.read.validate"),
            _step(graph, replay, status="failed", ago=timedelta(hours=1)),
        ]
    )
    await session.flush()

    fn = await catalogue.function(session, graph_id=graph.id, key=KEY)
    assert fn.plugin.startswith("invana.core.graph_read@")
    assert [(p.key, p.name) for p in fn.plans] == [("ask-once", "Ask once v2")], "one row per plan key, newest"
    assert fn.used_by == 1
    assert [(s.name, s.version) for s in fn.needed_by] == [("Route audit", 4)]
    c = fn.calls
    assert (c.calls, c.calls_prior, c.failed, c.failed_rate) == (2, 1, 1, 0.5), "the eval replay is left out"
    assert c.p95_ms == 40

    page, info = await catalogue.calls(session, graph_id=graph.id, key=KEY, params=ListParams(sort="-queued_at"))
    assert info.total == 3
    assert [r.status for r in page[:2]] == ["failed", "succeeded"], "newest first"
    assert page[0].run_id == root.id and page[0].title == "Which routes?"


async def test_an_unknown_function_is_not_found(session: AsyncSession, graph: Graph):
    with pytest.raises(NotFoundError):
        await catalogue.function(session, graph_id=graph.id, key="graph.read.nope")
    with pytest.raises(NotFoundError):
        await catalogue.calls(session, graph_id=graph.id, key="graph.read.nope", params=ListParams(sort="-queued_at"))
