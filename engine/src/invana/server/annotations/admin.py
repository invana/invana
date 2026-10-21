"""starlette-admin views for annotations (migration-plan §4.1)."""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class AnnotationView(ModelView):
    # ``records``, ``value_then`` and ``evidence`` are JSON payloads, not browsable columns.
    fields = [
        "id",
        "graph_id",
        "kind",
        "prop",
        "text",
        "label",
        "color",
        "author_kind",
        "reach",
        "created_by_id",
        "session_id",
        "message_id",
        "promoted_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["text", "label", "kind"]


class AnnotationAnchorView(ModelView):
    fields = ["id", "annotation_id", "graph_id", "record_id"]
    search_fields = ["record_id"]
