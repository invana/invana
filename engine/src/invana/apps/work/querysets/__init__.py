"""Every SQLAlchemy query behind Work — tasks, dependencies, projects, staffing
and the project records (migration-plan §4.1)."""

from invana.apps.work.querysets.assignment import ProjectAssignmentQuerySet
from invana.apps.work.querysets.branch import BranchFindingQuerySet, ProjectBranchQuerySet
from invana.apps.work.querysets.decision import ProjectDecisionQuerySet, ProjectProposalQuerySet
from invana.apps.work.querysets.dependency import TaskDependencyQuerySet
from invana.apps.work.querysets.finding import ProjectFindingQuerySet
from invana.apps.work.querysets.project import ProjectQuerySet
from invana.apps.work.querysets.report import ProjectReportQuerySet
from invana.apps.work.querysets.simulation import ProjectSimulationQuerySet
from invana.apps.work.querysets.task import TaskQuerySet

__all__ = [
    "BranchFindingQuerySet",
    "ProjectAssignmentQuerySet",
    "ProjectBranchQuerySet",
    "ProjectDecisionQuerySet",
    "ProjectFindingQuerySet",
    "ProjectProposalQuerySet",
    "ProjectQuerySet",
    "ProjectReportQuerySet",
    "ProjectSimulationQuerySet",
    "TaskDependencyQuerySet",
    "TaskQuerySet",
]
