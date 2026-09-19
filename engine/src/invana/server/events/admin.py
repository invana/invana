"""starlette-admin views for events (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette.requests import Request
from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class EventView(ModelView):
    """Audit events (docs/for-developers/modules/operate/features/audit-and-activity.md). Read + delete only — admin
    shouldn't be able
    to author new events or rewrite the audit trail in-place."""

    label = "Events"
    icon = "fa fa-clock-rotate-left"
    fields = [
        "id",
        "created_at",
        "graph_id",
        "actor_id",
        StringField("actor_kind", label="Actor kind"),
        "on_behalf_of_user_id",
        "parent_event_id",
        "action",
        "target_kind",
        "target_id",
        "project_id",
        "task_id",
        "run_id",
        "node_run_id",
        "skill_ids",
        "details",
        "trace_id",
    ]
    search_fields = ["action", "target_id", "target_kind"]
    sortable_fields = ["created_at", "action"]

    def can_create(self, request: Request) -> bool:
        return False

    def can_edit(self, request: Request) -> bool:
        return False
