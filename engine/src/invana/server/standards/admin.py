"""starlette-admin views for standards and their versions.

Versions are read-only: a version is immutable, and an edit here would change
terms its hash no longer describes.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class StandardView(ModelView):
    fields = [
        "id",
        "publisher",
        "name",
        "title",
        "origin",
        "current_version_id",
        "created_by_id",
        "created_at",
    ]
    search_fields = ["publisher", "name", "title"]


class StandardVersionView(ModelView):
    fields = ["id", "standard_id", "version", "terms", "content_hash", "why", "published_by_id", "published_at"]
    can_create = False
    can_edit = False
