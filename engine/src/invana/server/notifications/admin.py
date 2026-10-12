"""starlette-admin views for notification rules, channels, the inbox and deliveries.

A channel's ``secret_encrypted`` is never shown; deliveries, inbox rows and the
cursor are records of what happened and are read-only.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class NotificationRuleView(ModelView):
    fields = [
        "id",
        "graph_id",
        "name",
        "events",
        "match",
        "member_ids",
        "roles",
        "requester",
        "in_app",
        "channel_ids",
        "enabled",
        "created_at",
    ]
    search_fields = ["name"]


class NotificationChannelView(ModelView):
    fields = ["id", "graph_id", "name", "kind", "target", "created_by_id", "created_at"]
    search_fields = ["name"]
    can_create = False
    can_edit = False


class NotificationView(ModelView):
    fields = ["id", "graph_id", "user_id", "kind", "title", "body", "run_id", "approval_id", "read_at", "created_at"]
    search_fields = ["title"]
    can_create = False
    can_edit = False


class NotificationDeliveryView(ModelView):
    fields = [
        "id",
        "graph_id",
        "channel_id",
        "rule_id",
        "event_id",
        "firing_id",
        "approval_id",
        "status",
        "attempts",
        "error",
        "sent_at",
        "created_at",
    ]
    can_create = False
    can_edit = False


class NotificationCursorView(ModelView):
    fields = ["name", "created_at", "event_id"]
    can_create = False
