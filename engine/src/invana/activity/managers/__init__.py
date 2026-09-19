"""Activity rules, as classes (migration-plan §5)."""

from invana.activity.managers.task_read import TaskReadManager
from invana.activity.managers.tree import TreeManager

__all__ = ["TaskReadManager", "TreeManager"]
