"""SQLAlchemy async model for domain audit events (docs/for-developers/modules/operate/features/audit-and-activity.md).

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

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class ActorKind(enum.StrEnum):
    """Which kind of principal emitted the event (docs/for-developers/modules/work/spec.md).

    A polymorphic pair — ``(actor_kind, actor_id)`` — rather than a
    ``principals`` table (D5). ``actor_id`` therefore has **no FK**: it points
    at ``users.id`` or ``agents.id`` depending on the kind, and ``details``
    snapshots the display name so a retired agent or a deleted user still reads
    by name.

    - ``user``: a human, identified by ``actor_id``.
    - ``agent``: an agent acting in the graph. ``on_behalf_of_user_id`` is
      **NOT NULL** for these rows — the human at the root of the chain.
    - ``system``: background work the engine did on its own — auto-reconnect,
      introspection completion, a dependency unblocking a task.
    - ``external``: a scoped token (S10). ``actor_id`` is the token id.
    - ``anonymous``: pre-auth events such as ``auth.login_failed``.
    """

    user = "user"
    agent = "agent"
    system = "system"
    external = "external"
    anonymous = "anonymous"


# The old name, kept as an alias so call sites migrate without a flag day. The
# column and the wire field are both ``actor_kind``.
ActorType = ActorKind


_actor_kind_enum = Enum(
    ActorKind,
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
        # The activity tree for one task, and one run's rows (docs/for-developers/modules/work/spec.md).
        Index("ix_events_task_id_created_at", "task_id", "created_at"),
        Index("ix_events_run_id_created_at", "run_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="SET NULL"),
        nullable=True,
    )
    # No FK: ``actor_id`` is polymorphic over ``actor_kind`` (docs/for-developers/modules/work/spec.md). The
    # FK to ``users`` was dropped in migration 2c; the read path still LEFT
    # JOINs users, which resolves for ``actor_kind='user'`` and yields NULL for
    # the rest — exactly what the snapshot name in ``details`` is there for.
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    actor_kind: Mapped[ActorKind] = mapped_column(_actor_kind_enum, nullable=False)
    # The human at the root of the chain. Set by the engine from the root
    # run's actor, **never** from task input — that is what makes
    # attribution laundering impossible (docs/for-developers/modules/work/spec.md).
    on_behalf_of_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # The causal parent: the assignment that opened the run, the step that
    # spawned the child. This column is what makes the activity view a *tree*
    # rather than a sorted list.
    parent_event_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # Nullable scoping, so one filter reads one dimension of the trace.
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    node_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # For ``skill.*`` rows and step-derived ones.
    skill_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
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
