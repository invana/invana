"""A project's summary — the counts its Overview tiles and status bar show
(docs/for-developers/modules/work/features/projects-and-tasks.md), against a real Postgres.

The summary counts the project's own rows: another project's task the plan
draws is on the critical path but is not this project's work.
"""

from __future__ import annotations

import pytest

from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.standards.models import Standard  # noqa: F401
from invana.apps.work.managers import BranchManager, ProjectManager, ProjectSummaryManager, TaskManager
from invana.apps.work.models import ProjectDecision, ProjectFinding, TaskDependency
from invana.apps.work.schemas import ProjectCreate, TaskCreate

projects = ProjectManager()
branches = BranchManager()
tasks = TaskManager()
summaries = ProjectSummaryManager()

pytestmark = pytest.mark.asyncio


async def _project(session, graph, user, name: str):
    payload = ProjectCreate(name=name, type="research", question=f"{name}?")
    return await projects.create(session, graph_id=graph.id, payload=payload, actor=user)


async def _task(session, graph, user, project, title: str, status: str, agent: bool = False):
    task = await tasks.create(
        session, graph=graph, payload=TaskCreate(title=title, project_key=project.key), actor=user
    )
    task.status = status
    if agent:
        task.assignee_kind, task.assignee_id = "agent", user.id
    return task


async def test_summary_counts_the_projects_own_rows(session, graph, user):
    project = await _project(session, graph, user, "Flowering")
    other = await _project(session, graph, user, "Elsewhere")

    root = await branches.get(session, project=project, number=1)
    early, _late = await branches.fork(session, project=project, branch=root, titles=["Early", "Late"], actor=user)
    early.status = "pursuing"
    for number, reviewed, cites in [
        (1, True, [{"kind": "dataset", "ref": "acme/flights@1"}]),
        (2, False, [{"kind": "dataset", "ref": "acme/flights@2"}, {"kind": "dataset", "ref": "acme/routes@1"}]),
        (3, True, [{"kind": "record", "ref": "n1"}]),
    ]:
        session.add(
            ProjectFinding(
                project_id=project.id,
                branch_id=root.id,
                number=number,
                statement=f"finding {number}",
                stance="supports",
                cites=cites,
                reviewed_by_id=user.id if reviewed else None,
            )
        )
    session.add(
        ProjectDecision(
            project_id=project.id, branch_id=early.id, number=1, verdict="supported", choice="pursue", rationale="r"
        )
    )

    outside = await _task(session, graph, user, other, "Outside", "open")
    a = await _task(session, graph, user, project, "A", "in_progress")
    b = await _task(session, graph, user, project, "B", "needs_input", agent=True)
    await _task(session, graph, user, project, "C", "done", agent=True)
    session.add_all(
        [TaskDependency(task_id=a.id, depends_on_id=outside.id), TaskDependency(task_id=b.id, depends_on_id=a.id)]
    )
    await session.flush()

    summary = await summaries.for_project(session, project=project)

    assert summary.branches == 3
    assert summary.branches_by_status == {"open": 2, "pursuing": 1}
    assert (summary.findings, summary.findings_reviewed, summary.datasets) == (3, 2, 2)
    assert summary.todos_by_status == {"in_progress": 1, "needs_input": 1, "done": 1}
    assert (summary.todos_open, summary.todos_open_for_agents) == (2, 1)
    assert summary.decisions == 1
    # The plan draws the other project's task, so the path runs through it.
    assert summary.critical_path == 3


async def test_summary_of_an_empty_project_is_zero(session, graph, user):
    busy = await _project(session, graph, user, "Busy")
    await _task(session, graph, user, busy, "Elsewhere", "in_progress")
    empty = await _project(session, graph, user, "Empty")
    await session.flush()

    summary = await summaries.for_project(session, project=empty)

    assert summary.branches == 1
    assert summary.branches_by_status == {"open": 1}
    assert (summary.findings, summary.findings_reviewed, summary.datasets, summary.decisions) == (0, 0, 0, 0)
    assert summary.todos_by_status == {}
    assert (summary.todos_open, summary.todos_open_for_agents, summary.critical_path) == (0, 0, 0)
