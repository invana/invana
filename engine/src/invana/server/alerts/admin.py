"""starlette-admin view for alert rules — the clock's cursor (``last_seq``) is shown, not edited."""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class AlertRuleView(ModelView):
    fields = [
        "id",
        "graph_id",
        "name",
        "enabled",
        "match",
        "notify_user_ids",
        "last_fired_at",
        "last_seq",
        "created_by_id",
        "created_at",
        "updated_at",
    ]
    exclude_fields_from_create = ["last_fired_at", "last_seq", "created_at", "updated_at"]
    exclude_fields_from_edit = ["last_fired_at", "last_seq", "created_at", "updated_at"]
    search_fields = ["name"]
