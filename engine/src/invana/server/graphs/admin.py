"""starlette-admin views for graphs (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class GraphContainerView(ModelView):
    label = "Graphs"
    icon = "fa fa-project-diagram"
    fields = [
        "id",
        "slug",
        "name",
        "description",
        "instructions",
        StringField("status", label="Status"),
        "connection",
        "created_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "slug"]
    sortable_fields = ["name", "slug", "created_at"]


class GraphMemberView(ModelView):
    label = "Graph members"
    icon = "fa fa-users"
    # Binary membership post-docs/for-developers/modules/identity-and-access/features/membership.md — no role column.
    fields = [
        "graph_id",
        "user_id",
        "created_at",
    ]
    sortable_fields = ["created_at"]


class GraphConnectionView(ModelView):
    label = "Graph connections"
    icon = "fa fa-plug"
    fields = [
        "id",
        "graph_id",
        "uri",
        "connector_class",
        "database",
        "read_only",
        StringField("status", label="Status"),
        "model_id",
        "last_health_check_at",
        "latency_ms",
        "server_version",
        "server_version_source",
        "compatibility_status",
        "version_acknowledged",
        "created_at",
        "updated_at",
    ]
    search_fields = ["uri"]
