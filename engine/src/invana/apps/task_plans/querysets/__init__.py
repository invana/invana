"""Every SQLAlchemy query against the plan library (migration-plan §4.1)."""

from invana.apps.task_plans.querysets.task_plan import TaskPlanQuerySet

__all__ = ["TaskPlanQuerySet"]
