"""A project's counts — what its Overview tiles and its detail's status bar show
(docs/for-developers/modules/work/features/projects-and-tasks.md).

Every count is taken from the rows the project's lists read — branches,
findings, the findings' dataset cites, the project's own tasks, decisions — and
the critical path from the same derivation the plan returns, so a tile never
disagrees with the list under it. Studio formats these; it counts no list.

A task from another project that the plan draws (because one of this project's
tasks depends on it) is not this project's work, so it is not counted.

Usage::

    summary = await ProjectSummaryManager().for_project(session, project=project)
    summary.todos_open, summary.findings_reviewed, summary.critical_path
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.managers.plan import PlanManager
from invana.apps.work.models import OPEN_TASK_STATUSES, Project
from invana.apps.work.querysets import (
    ProjectBranchQuerySet,
    ProjectDecisionQuerySet,
    ProjectFindingQuerySet,
    TaskQuerySet,
)
from invana.apps.work.schemas import ProjectSummary

_OPEN = {s.value for s in OPEN_TASK_STATUSES}


def cited_datasets(cites_per_finding: list[list]) -> set[str]:
    """The ``publisher/name`` of every dataset the findings cite, version dropped."""
    out: set[str] = set()
    for cites in cites_per_finding:
        for cite in cites:
            if isinstance(cite, dict) and cite.get("kind") == "dataset" and cite.get("ref"):
                out.add(str(cite["ref"]).rsplit("@", 1)[0])
    return out


class ProjectSummaryManager:
    """Stateless. The session is the first argument of every method."""

    branches_qs = ProjectBranchQuerySet()
    findings_qs = ProjectFindingQuerySet()
    decisions_qs = ProjectDecisionQuerySet()
    tasks_qs = TaskQuerySet()
    plans = PlanManager()

    async def for_project(self, session: AsyncSession, *, project: Project) -> ProjectSummary:
        """Every count for one project. The caller has already checked the reader may see it."""
        branches = await self.branches_qs.count_by_status(session, project_id=project.id)
        findings, reviewed = await self.findings_qs.review_counts(session, project_id=project.id)
        cites = await self.findings_qs.cites_for_project(session, project_id=project.id)
        todos = await self.tasks_qs.status_counts(session, project_id=project.id)
        for_agents = await self.tasks_qs.status_counts(session, project_id=project.id, assignee_kind="agent")
        _, derived = await self.plans.derive_for(session, graph_id=project.graph_id, project_id=project.id)
        return ProjectSummary(
            branches=sum(branches.values()),
            branches_by_status=branches,
            findings=findings,
            findings_reviewed=reviewed,
            datasets=len(cited_datasets(cites)),
            todos_by_status=todos,
            todos_open=sum(n for s, n in todos.items() if s in _OPEN),
            todos_open_for_agents=sum(n for s, n in for_agents.items() if s in _OPEN),
            decisions=await self.decisions_qs.count_for_project(session, project_id=project.id),
            critical_path=len(derived.critical_path),
        )
