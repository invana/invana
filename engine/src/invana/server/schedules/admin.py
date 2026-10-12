"""starlette-admin views for schedules and their firings.

Firings are read-only: a firing is the record of what happened.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class ScheduleView(ModelView):
    fields = [
        "id",
        "graph_id",
        "name",
        "agent_id",
        "instructions",
        "cron",
        "timezone",
        "status",
        "missed",
        "overlap",
        "deliver_in_app",
        "channel_ids",
        "approve_outward",
        "approval_deadline_s",
        "next_fire_at",
        "owner_id",
        "created_at",
    ]
    search_fields = ["name", "cron"]


class ScheduleFiringView(ModelView):
    fields = [
        "id",
        "schedule_id",
        "due_at",
        "fired_at",
        "outcome",
        "catch_up",
        "manual",
        "run_id",
        "reason",
        "delivered_at",
    ]
    can_create = False
    can_edit = False
