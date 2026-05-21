"""SQLAlchemy async model for domain audit events (RFC-018).

One row per domain-level write. Append-only — there are no UPDATE or DELETE
code paths exposed by the engine. FKs are ``ON DELETE SET NULL`` so the audit
trail outlives the entities it describes.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class ActorType(enum.StrEnum):
    """Who emitted the event.

    - ``user``: a human user, identified by ``actor_id`` (FK to users.id).
    - ``system``: background work the engine did on its own — auto-reconnect,
      schema introspection completion, future agent runs. ``actor_id`` is null.
    - ``anonymous``: pre-auth events such as ``auth.login_failed`` where we
      have no identified user. ``actor_id`` is null.
    """

    user = "user"
    system = "system"
    anonymous = "anonymous"


_actor_type_enum = Enum(
    ActorType,
    name="event_actor_type",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        # Drives the per-graph view (`?graph_id=` filter + newest first).
        Index("ix_events_graph_id_created_at", "graph_id", "created_at"),
        # Drives the global view (newest first across all graphs).
        Index("ix_events_created_at", "created_at"),
        # Drives "all actions by this actor" admin queries.
        Index("ix_events_actor_id_created_at", "actor_id", "created_at"),
        # Action-prefix filtering (LIKE 'skill.%' etc.) benefits from this
        # composite — Postgres can range-scan on the action prefix and order
        # by created_at within.
        Index("ix_events_action_created_at", "action", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_type: Mapped[ActorType] = mapped_column(_actor_type_enum, nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # Changed-keys diff for updates, snapshot for create/delete, action-
    # specific payload for query/auth. Sensitive fields (api_key, password,
    # *_hash, *_encrypted) are always omitted by emit_event helpers.
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # OTel trace_id (hex) of the originating request, for trace correlation.
    trace_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
