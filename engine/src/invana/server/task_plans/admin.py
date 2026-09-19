"""starlette-admin views for the plan library (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class TaskPlanView(ModelView):
    label = "Plans"
    icon = "fa fa-diagram-next"
    # No `spec`: the plan is its `tasks` rows now, and a jsonb column echoing
    # them would be a second source of truth (task-model-migration §2.2).
    fields = [
        "id",
        "graph_id",
        "key",
        "version",
        "name",
        "description",
        "kind",
        "origin",
        "intent",
        "reusable",
        "todo_id",
        "promoted_from_run_id",
        "created_at",
    ]
    search_fields = ["key", "name", "description"]


class PlanTaskView(ModelView):
    """One node of a plan — never a Todo (``apps/work`` owns those)."""

    label = "Plan tasks"
    icon = "fa fa-diagram-project"
    fields = [
        "id",
        "task_plan_id",
        "parent_id",
        "ordinal",
        "key",
        "form",
        "step_key",
        "title",
        "args",
        "depends_on",
        "when",
        "map_over",
        "created_at",
    ]
    search_fields = ["key", "step_key", "title"]
