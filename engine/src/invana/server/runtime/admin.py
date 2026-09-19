"""starlette-admin views for runtime (migration-plan §4.1).

Beside the code they describe, rather than in one 39-class file.
Sensitive columns stay out of ``fields`` so they are neither shown
nor editable.
"""

from __future__ import annotations

from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class TaskRunView(ModelView):
    """A run, as it was opened — the ask included, since it has no row of its own."""

    fields = [
        "id",
        "graph_id",
        "parent_run_id",
        "todo_id",
        "task_plan_id",
        StringField("role", label="Role"),
        "ask_kind",
        "body",
        "params",
        "session_id",
        "plan_origin",
        "plan_revision",
        "status",
        "outcome",
        "assistant_message_id",
        "queued_at",
        "started_at",
        "finished_at",
        "error",
        "result",
        "cost_usd",
        "stream_seq",
        "cursor",
    ]
    search_fields = ["body"]


class RunNodeView(ModelView):
    """The nodes inside a run — the same table, filtered to the children."""

    fields = [
        "id",
        "parent_run_id",
        "message_id",
        "seq",
        "task_key",
        "step_key",
        "label",
        "attempt",
        "status",
        "started_at",
        "finished_at",
        "detail",
        "input",
        "output",
        "error",
        "result",
        "tokens_in",
        "tokens_out",
        "cost_usd",
    ]


class TaskStreamView(ModelView):
    fields = ["id", "run_id", "seq", "kind", "payload", "idem_key", "created_at"]


class EmissionView(ModelView):
    """One thing a step produced (docs/for-developers/modules/ask/features/the-answer-surface.md)."""

    fields = [
        "id",
        "run_id",
        "message_id",
        "step_run_id",
        "seq",
        StringField("kind", label="Kind"),
        "payload",
        "template_id",
        "citation",
        "created_at",
    ]


class ProjectionTemplateView(ModelView):
    """A declared mapping from a shape to a surface
    (docs/for-developers/modules/ask/features/projections.md)."""

    fields = [
        "id",
        "graph_id",
        "name",
        StringField("kind", label="Kind"),
        StringField("surface", label="Surface"),
        "accepts",
        "spec",
        "intent",
        "version",
        StringField("status", label="Status"),
        "created_at",
    ]
    search_fields = ["name", "intent"]


class TaskPromptView(ModelView):
    """What a person answered when a step asked."""

    fields = [
        "id",
        "run_id",
        "step_seq",
        StringField("kind", label="Kind"),
        "options",
        "deadline_s",
        "template_id",
        StringField("answered_by_kind", label="Answered By Kind"),
        "answered_by_id",
        "value",
        "answered_at",
    ]
