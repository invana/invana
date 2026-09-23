"""starlette-admin views for Govern's two tables.

Both are read-heavy and edited through the product, so these exist for the same
reason every other admin view does: somebody debugging a Graph needs to see the
rows. Nothing here is sensitive — a lens is meant to be readable, which is the
whole argument of [GR5](docs/for-developers/modules/govern/features/guardrails.md).
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class LensView(ModelView):
    label = "Lenses"
    icon = "fa fa-filter"
    fields = [
        "id",
        "graph_id",
        "kind",
        "key",
        "name",
        "scope",
        "rules",
        "cast",
        "closed_layers",
        "as_of",
        "created_in_run_id",
        "created_by_id",
        "version",
        "created_at",
        "updated_at",
    ]
    search_fields = ["key", "name", "scope"]


class RunTouchView(ModelView):
    label = "Run touches"
    icon = "fa fa-fingerprint"
    # A projection of the ledger: read it, never hand-edit it. Rebuilding from
    # `task_stream` is the supported way to change what is here.
    can_create = False
    can_edit = False
    fields = [
        "id",
        "run_id",
        "graph_id",
        "seq",
        "step_key",
        "address",
        "layer",
        "sublayer",
        "participant",
        "direction",
        "rule_matched",
        "why",
        "volume",
        "applied",
        "sent",
        "query",
        "cost_usd",
        "duration_ms",
        "at",
    ]
    search_fields = ["address", "participant", "step_key"]
