"""starlette-admin views for the ledger — every one read-only.

A ledger row is never edited or deleted (a correction is a new row); checks and
exports are records of what happened.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class LedgerRowView(ModelView):
    fields = [
        "id",
        "graph_id",
        "seq",
        "at",
        "actor_kind",
        "actor_user_id",
        "actor_agent_id",
        "actor_chain",
        "act",
        "layer",
        "touched",
        "touched_line",
        "verdict",
        "refused_by",
        "rule",
        "run_id",
        "step_run_id",
        "run_number",
        "where",
        "args",
        "hash",
        "prev_hash",
    ]
    search_fields = ["act", "touched"]
    can_create = False
    can_edit = False
    can_delete = False


class LedgerCheckView(ModelView):
    fields = ["graph_id", "verified_at", "ok", "last_seq", "broken_seq"]
    can_create = False
    can_edit = False
    can_delete = False


class LedgerExportView(ModelView):
    fields = ["id", "graph_id", "requested_by_id", "filters", "format", "rows", "created_at"]
    can_create = False
    can_edit = False
    can_delete = False
