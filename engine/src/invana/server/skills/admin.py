"""starlette-admin views for ``skills``, ``skill_versions`` and what a draft asked.

Beside the code they describe, rather than in one 39-class file
(migration-plan §4.1). ``server/admin`` keeps the mount, the sections and the
auth provider, and imports this.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class SkillView(ModelView):
    label = "Skills"
    icon = "fa fa-wand-magic-sparkles"
    # The prose is not here: it lives on the version, and the skill row only
    # says which one is current.
    fields = [
        "id",
        "graph_id",
        "name",
        "origin",
        "current_version_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name"]


class SkillVersionView(ModelView):
    label = "Skill versions"
    icon = "fa fa-clock-rotate-left"
    # Read-only on purpose: a published version is immutable, and the admin is
    # not the one exception to that.
    fields = [
        "id",
        "skill_id",
        "version",
        "description",
        "content",
        "when_to_use",
        "plan_id",
        "published_by_id",
        "published_at",
        "created_at",
    ]
    search_fields = ["description", "content"]
    can_create = False
    can_edit = False
    can_delete = False


class SkillClarificationView(ModelView):
    label = "Skill clarifications"
    icon = "fa fa-circle-question"
    # What the planner asked about one sentence, and the reading the author
    # picked. Read-only: an answer is part of what published.
    fields = [
        "id",
        "skill_version_id",
        "span",
        "question",
        "options",
        "answer",
        "answered_by_id",
        "answered_at",
        "created_at",
    ]
    search_fields = ["span", "question"]
    can_create = False
    can_edit = False


class SkillBindingView(ModelView):
    label = "Skill bindings"
    icon = "fa fa-link"
    fields = [
        "id",
        "skill_id",
        "agent_id",
        "bound_by_id",
        "bound_at",
    ]
