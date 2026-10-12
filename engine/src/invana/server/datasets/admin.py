"""starlette-admin views for datasets, their versions, records, bindings, claims and scores.

Versions and records are read-only: a version is immutable, and an edit here
would change content its hash no longer describes.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class DatasetView(ModelView):
    fields = [
        "id",
        "publisher",
        "name",
        "title",
        "origin",
        "key_column",
        "visibility",
        "sensitivity",
        "column_sensitivity",
        "refresh_schedule",
        "refresh_source",
        "current_version_id",
        "created_by_id",
        "created_at",
    ]
    search_fields = ["publisher", "name", "title"]


class DatasetVersionView(ModelView):
    fields = [
        "id",
        "dataset_id",
        "version",
        "content_hash",
        "licence",
        "author_chain",
        "columns",
        "record_count",
        "source",
        "derived_from",
        "why",
        "published_by_id",
        "published_at",
        "retracted_at",
        "retracted_by_id",
        "retraction_reason",
    ]
    can_create = False
    can_edit = False


class DatasetRecordView(ModelView):
    fields = ["id", "version_id", "key", "values", "provenance"]
    search_fields = ["key"]
    can_create = False
    can_edit = False


class DatasetBindingView(ModelView):
    fields = ["id", "graph_id", "model_id", "dataset_id", "dataset_version_id", "type_name", "run_id", "bound_at"]


class DatasetStandardView(ModelView):
    fields = ["id", "dataset_id", "standard_id", "standard_version_id", "mode", "mapping", "attached_at"]


class DatasetConformanceView(ModelView):
    fields = [
        "id",
        "dataset_version_id",
        "standard_version_id",
        "record_count",
        "conforming",
        "score",
        "violation_count",
        "checked_at",
    ]
    # Derived from the records; recomputed by the engine, never edited.
    can_create = False
    can_edit = False
