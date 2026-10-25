"""starlette-admin view for approvals — read-only: a named approver decides through the API."""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class ApprovalView(ModelView):
    fields = [
        "id",
        "graph_id",
        "kind",
        "subject_kind",
        "subject_id",
        "asked_by",
        "wants",
        "routed_reason",
        "step_run_id",
        "scope",
        "run_id",
        "schedule_id",
        "title",
        "payload",
        "approver_ids",
        "deadline_at",
        "reminded_at",
        "status",
        "decided_by_id",
        "decided_at",
        "note",
        "created_at",
    ]
    can_create = False
    can_edit = False
