"""Work rules, as classes — tasks, their dependencies, projects, staffing, the
plan and the project records. This is the Python API (migration-plan §6)."""

from invana.apps.work.managers.branch import BranchManager
from invana.apps.work.managers.decision import DecisionManager
from invana.apps.work.managers.dependency import DependencyManager
from invana.apps.work.managers.plan import PlanManager
from invana.apps.work.managers.project import ProjectManager, slugify
from invana.apps.work.managers.proposal import ProposalManager
from invana.apps.work.managers.report import ReportManager
from invana.apps.work.managers.staffing import StaffingManager
from invana.apps.work.managers.task import TaskManager, blocked_by_text

__all__ = [
    "BranchManager",
    "DecisionManager",
    "DependencyManager",
    "PlanManager",
    "ProjectManager",
    "ProposalManager",
    "ReportManager",
    "StaffingManager",
    "TaskManager",
    "blocked_by_text",
    "slugify",
]
