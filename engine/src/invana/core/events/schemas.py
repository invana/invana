"""Pydantic request/response models for the Events API
(docs/for-developers/modules/operate/features/audit-and-activity.md)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from invana.core.events.models import ActorKind


class ActorRef(BaseModel):
    """Denormalised actor reference shown alongside each event row.

    Populated from a JOIN on the users table at read time so the Studio
    doesn't need a second lookup per row. Null when the actor has been
    deleted (FK is ON DELETE SET NULL) — in that case ``details`` may
    carry an ``actor_username_snapshot`` for human-readable fallback.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: str


class OnBehalfOfRef(BaseModel):
    """The human an agent acted for — the *on behalf of* line under an agent row."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: str


class EventRead(BaseModel):
    """Wire shape returned by the read APIs."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str | None
    actor: ActorRef | None
    actor_kind: ActorKind
    # Filled for ``actor_kind='agent'`` rows, where ``actor`` is null because
    # the actor is not a user. The name comes from the agents table, or from
    # ``details.actor_name`` when the agent row is gone
    # (docs/for-developers/modules/operate/features/audit-and-activity.md convention).
    actor_name: str | None = None
    on_behalf_of: OnBehalfOfRef | None = None
    parent_event_id: str | None = None
    project_id: str | None = None
    task_id: str | None = None
    run_id: str | None = None
    node_run_id: str | None = None
    skill_ids: list[str] = []
    action: str
    target_kind: str | None
    target_id: str | None
    details: dict
    trace_id: str | None
    created_at: datetime


class EventListResponse(BaseModel):
    """Paginated event list.

    Keyset pagination on ``(created_at DESC, id DESC)``. ``next_cursor`` is
    opaque to the client; pass it back as ``?cursor=<value>`` for the next
    page. Null means no more rows.
    """

    items: list[EventRead]
    next_cursor: str | None
