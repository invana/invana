"""starlette-admin views for boards and their history (migration-plan §4.1)."""

from __future__ import annotations

from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class BoardView(ModelView):
    # Heavy render blobs (snapshot / positions / view_state / filters / settings)
    # are excluded from the list for readability — they're JSON payloads, not
    # browsable columns.
    fields = [
        "id",
        StringField("kind", label="Kind"),
        "subject_id",
        "session_id",
        "graph_id",
        "created_by_id",
        "title",
        "instructions",
        "source_query",
        "pinned",
        "archived",
        "created_at",
        "updated_at",
    ]
    search_fields = ["title", "kind", "subject_id"]


class BoardVersionView(ModelView):
    # Append-only history. Heavy render blobs (snapshot / banner / styling /
    # settings) are excluded — JSON payloads, not browsable.
    fields = [
        "id",
        "board_id",
        "graph_id",
        "created_by_id",
        "message_id",
        StringField("cause", label="Cause"),
        "label",
        "node_count",
        "edge_count",
        "source_query",
        "created_at",
    ]
    search_fields = ["label"]
