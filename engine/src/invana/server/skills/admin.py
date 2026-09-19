"""starlette-admin view for ``skills``.

Beside the code it describes, rather than in one 39-class file
(migration-plan §4.1). ``server/admin`` keeps the mount, the sections and the
auth provider, and imports this.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class SkillView(ModelView):
    label = "Skills"
    icon = "fa fa-wand-magic-sparkles"
    fields = [
        "id",
        "graph_id",
        "name",
        "description",
        "content",
        "when_to_use",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "description"]
