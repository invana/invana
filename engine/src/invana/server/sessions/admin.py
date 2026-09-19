"""starlette-admin views for sessions (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class SessionView(ModelView):
    fields = [
        "id",
        "graph_id",
        "created_by_id",
        StringField("surface", label="Surface"),
        "model_id",
        "title",
        "pinned",
        "archived",
        "message_count",
        "node_count",
        "edge_count",
        "last_status",
        "created_at",
        "updated_at",
    ]
    search_fields = ["title"]


class SessionMessageView(ModelView):
    fields = [
        "id",
        "session_id",
        "seq",
        StringField("role", label="Role"),
        StringField("status", label="Status"),
        StringField("operation", label="Operation"),
        StringField("mode", label="Mode"),
        "via",
        "query_language",
        "rationale",
        "clarification_options",
        "feedback",
        "row_count",
        "execution_time_ms",
        "llm_time_ms",
        "timeout_s",
        "run_id",
        "created_at",
    ]
