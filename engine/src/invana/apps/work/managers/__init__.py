"""Work rules, as classes — tasks, their dependencies, projects, staffing and
the plan. This is the Python API (migration-plan §6)."""

from invana.apps.work.managers.dependency import DependencyManager
from invana.apps.work.managers.plan import PlanManager
from invana.apps.work.managers.project import ProjectManager, slugify
from invana.apps.work.managers.staffing import StaffingManager
from invana.apps.work.managers.task import TaskManager, blocked_by_text

__all__ = [
    "DependencyManager",
    "PlanManager",
    "ProjectManager",
    "StaffingManager",
    "TaskManager",
    "blocked_by_text",
    "slugify",
]
