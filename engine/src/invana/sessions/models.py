"""SQLAlchemy async models for Query Sessions (RFC-024).

A ``Session`` is a threaded conversation against a graph: the user asks (a
query, or natural language), the assistant answers. Each ask/answer is a pair of
``SessionMessage`` rows. Sessions are **graph-scoped and private to their
creator**; both FKs hard-CASCADE (graph delete or user delete removes the
sessions — see RFC-024 Decision 11).

Only message *metadata* is stored — never the result payload (nodes/edges/rows).
The canvas is repainted by re-running ``source_query`` (Decision 3).
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class SessionSurface(enum.StrEnum):
    """Which Studio surface a session lives on (RFC-031).

    ``explorer`` sessions query the graph (NL → query); ``modeller`` sessions
    author a model's draft (NL → ``propose_model``). Existing rows and the create
    path default to ``explorer`` so Explorer behaviour is untouched.
    """

    explorer = "explorer"
    modeller = "modeller"


class SessionMessageRole(enum.StrEnum):
    user = "user"
    assistant = "assistant"


class SessionMessageStatus(enum.StrEnum):
    """Lifecycle of an assistant reply tied to a query execution."""

    running = "running"
    ok = "ok"
    error = "error"


_surface_enum = Enum(
    SessionSurface,
    name="session_surface",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)
_role_enum = Enum(
    SessionMessageRole,
    name="session_message_role",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)
_status_enum = Enum(
    SessionMessageStatus,
    name="session_message_status",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Private to the creator (RFC-024 Decision 6); CASCADE on user delete
    # (Decision 11) — sessions are private workspace, not an audit trail.
    created_by_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Which Studio surface this session lives on (RFC-031). ``explorer`` queries
    # the graph; ``modeller`` authors a model draft. Defaults to ``explorer`` so
    # existing rows + the create path keep working.
    surface: Mapped[SessionSurface] = mapped_column(_surface_enum, default=SessionSurface.explorer, nullable=False)
    # The model a ``modeller`` session authors (RFC-031 Decision 2). Bound on the
    # first generation when absent; ON DELETE SET NULL so deleting the model
    # un-binds the session rather than removing it. Always null for ``explorer``.
    model_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("graph_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    # Per-user organization flags. Pinned sessions sort to the top of the list;
    # archived sessions are hidden from the default list (revealed on demand).
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Denormalized running totals for the list meta line (Decision 4).
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    node_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    edge_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Denormalized status of the latest assistant reply, so the list can mark a
    # session failed/running without loading its messages. Null until the first
    # reply lands. Maintained alongside the totals above on send/rerun.
    last_status: Mapped[SessionMessageStatus | None] = mapped_column(_status_enum, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class SessionMessage(Base):
    __tablename__ = "session_messages"
    __table_args__ = (UniqueConstraint("session_id", "seq", name="uq_session_message_seq"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Monotonic per-session ordering (1, 2, 3…) — stable regardless of
    # created_at collisions.
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[SessionMessageRole] = mapped_column(_role_enum, nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Assistant-only metadata (null on user rows).
    status: Mapped[SessionMessageStatus | None] = mapped_column(_status_enum, nullable=True)
    # How this ask was started: "nl" (translated from natural language) or "ql"
    # (run as a raw query). Persisted so the composer restores the original mode
    # on reopen instead of guessing from ``via`` — which fails when the latest
    # reply errored or was a rerun (no provider label). Null on existing rows.
    mode: Mapped[str | None] = mapped_column(String(2), nullable=True)
    via: Mapped[str | None] = mapped_column(String(255), nullable=True)
    query_language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # The query that produced this reply, so it can be re-run (Decision 10).
    source_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    # NL only — the model's one-line rationale for ``source_query`` (RFC-036).
    # Replayed (with the query) as conversation context so a follow-up like
    # "only show 5" can refine the prior turn. Null on QL, on rerun, and on
    # existing rows.
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    # NL clarification only — short answer options the user can pick instead of
    # retyping (RFC-038). Set when this reply is a clarifying question (the reply
    # has no ``source_query``); null otherwise.
    clarification_options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # 👍/👎 on an assistant reply — a capture signal for the learning loop
    # (RFC-038/039). "up" | "down"; null = no vote / cleared.
    feedback: Mapped[str | None] = mapped_column(String(4), nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # NL only — wall-clock of the LLM translation step that produced
    # ``source_query`` (RFC-030). Null on QL and on rerun (no translation), so
    # the UI can show LLM time next to query time and see which dominated.
    llm_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # The per-ask timeout (seconds) this message was sent with — budgets the LLM
    # translation (nl) and the query execution (nl + ql), so the composer can
    # restore the user's choice on reopen and re-run honours it (RFC-030). Null
    # when the ask carried no timeout, and on existing rows.
    timeout_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    node_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    edge_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
