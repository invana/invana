"""starlette-admin views for ``rules`` and ``rule_versions``."""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class RuleView(ModelView):
    label = "Rules"
    icon = "fa fa-scale-balanced"
    # The statement is not here: it lives on the version.
    fields = [
        "id",
        "graph_id",
        "project_id",
        "active",
        "order",
        "current_version_id",
        "created_at",
        "updated_at",
    ]


class RuleVersionView(ModelView):
    label = "Rule versions"
    icon = "fa fa-clock-rotate-left"
    fields = [
        "id",
        "rule_id",
        "version",
        "statement",
        "published_by_id",
        "published_at",
    ]
    search_fields = ["statement"]
    # A published version is immutable, and the admin is not the exception.
    can_create = False
    can_edit = False
    can_delete = False
