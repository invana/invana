"""Pydantic request/response models for the Events API (RFC-018)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from invana.events.models import ActorType


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


class EventRead(BaseModel):
    """Wire shape returned by the read APIs."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str | None
    actor: ActorRef | None
    actor_type: ActorType
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
