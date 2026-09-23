"""starlette-admin views for agents (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class AgentView(ModelView):
    label = "Agents"
    icon = "fa fa-robot"
    fields = [
        "id",
        "graph_id",
        "key",
        "name",
        "description",
        "kind",
        "status",
        "lifetime",
        "instructions",
        "workflow_spec",
        "budget",
        "policy",
        "parent_agent_id",
        "spawned_in_run_id",
        "version",
        "created_by_kind",
        "created_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "key", "description"]
