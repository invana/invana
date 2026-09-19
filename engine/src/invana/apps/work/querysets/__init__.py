"""Every SQLAlchemy query behind Work — tasks, dependencies, projects and
staffing (migration-plan §4.1)."""

from invana.apps.work.querysets.assignment import ProjectAssignmentQuerySet
from invana.apps.work.querysets.dependency import TaskDependencyQuerySet
from invana.apps.work.querysets.project import ProjectQuerySet
from invana.apps.work.querysets.task import TaskQuerySet

__all__ = [
    "ProjectAssignmentQuerySet",
    "ProjectQuerySet",
    "TaskDependencyQuerySet",
    "TaskQuerySet",
]
