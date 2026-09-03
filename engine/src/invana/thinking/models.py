"""SQLAlchemy models for thoughts · thinkings · thinking_steps · thought_stream (RFC-048).

``thoughts`` is the ask, written once and never edited. ``thinkings`` is one run
of a workflow over a thought (a rethink adds another row). ``thinking_steps`` is
one row **per attempt** of a task (RFC-052 § 3.2) — the card's step chips and
the trace are this table at two resolutions. ``thought_stream`` is the
append-only log Studio tails: persist first, then broadcast; every subscription
takes ``after=<seq>`` so a reload replays from the record (RFC-048 "a log with a
cursor").

Every JSON column is ``sqlalchemy.JSON`` (never JSONB) so SQLite dev keeps
working; ids are ``String(36)`` UUIDs like every other table.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class ThinkingStatus(enum.StrEnum):
    queued = "queued"
    thinking = "thinking"
    awaiting_input = "awaiting_input"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


TERMINAL_THINKING_STATUSES = frozenset(
    {ThinkingStatus.succeeded, ThinkingStatus.failed, ThinkingStatus.cancelled, ThinkingStatus.awaiting_input}
)


class StepStatus(enum.StrEnum):
    queued = "queued"
    running = "running"
    needs_input = "needs_input"
    succeeded = "succeeded"
    failed = "failed"
    stopped = "stopped"


class Thought(Base):
    """The ask, as asked — immutable (RFC-048)."""

    __tablename__ = "thoughts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # A thought attaches to a session's user message (RFC-048 D10); both nullable
    # so thoughts can later be posed outside a session (schedules, the CLI).
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    message_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True
    )
    author_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # "nl" | "ql" — how the ask was posed.
    kind: Mapped[str] = mapped_column(String(2), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # The composer's knobs for this ask: language, llm_provider_id, timeout_s,
    # parameters — what a rethink needs to re-ask the same question.
    params: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Thinking(Base):
    """One run of a workflow over a thought."""

    __tablename__ = "thinkings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    thought_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("thoughts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Which built-in workflow answers it: nl-query · ql-query · modeller-generate.
    workflow_key: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=ThinkingStatus.queued.value, nullable=False)
    # The assistant reply this run writes when it finishes. A resume (RFC-048
    # clarification) moves it to the new reply row; steps remember the reply
    # they ran under via ``ThinkingStep.message_id``.
    assistant_message_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True
    )
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Monotonic per-thinking emission counter — the stream's cursor.
    stream_seq: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Where to re-enter the workflow on resume: {"step": <index>}.
    cursor: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ThinkingStep(Base):
    """One attempt of one task within a thinking."""

    __tablename__ = "thinking_steps"
    __table_args__ = (UniqueConstraint("thinking_id", "seq", "attempt", name="uq_thinking_step_attempt"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    thinking_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("thinkings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The assistant reply this attempt ran under, so a reply's step list is a
    # direct lookup and a resumed thinking's earlier question keeps its own.
    message_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    task_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # Human label from the workflow spec ("Understand"), RFC-051 § 3.1.
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=StepStatus.queued.value, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The one-liner shown on the step row ("proposed Cypher · 5 lines").
    detail: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    # Trace: digests and small facts, never raw payloads (RFC-048 task contract).
    input: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ThoughtStream(Base):
    """Append-only emission log for one thinking (RFC-048 "one structure, three jobs")."""

    __tablename__ = "thought_stream"
    __table_args__ = (UniqueConstraint("thinking_id", "seq", name="uq_thought_stream_seq"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    thinking_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("thinkings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Lets a retried task's duplicate emission collapse (RFC-048).
    idem_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
