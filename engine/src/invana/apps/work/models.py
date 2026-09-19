"""SQLAlchemy models for Work — ``projects``, ``project_assignments``, ``tasks``
and ``task_dependencies`` (docs/for-developers/modules/work/spec.md).

`projects` folded in here at migration-plan §17 step 6: the two packages held
one idea and imported each other. Table names are unchanged, so no migration.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base

# Sub-tasks are allowed three deep. Past that a task is a project.
MAX_TASK_DEPTH = 3


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class TaskStatus(enum.StrEnum):
    """The states of a task (docs/for-developers/modules/work/spec.md)

    The one that carries the design is ``review``: **an agent never marks its
    own task done.** It posts a result and a human accepts — the governance
    seam, and the capture signal the learning loop reads (docs/for-developers/modules/agents/spec.md).
    """

    open = "open"
    assigned = "assigned"
    in_progress = "in_progress"
    needs_input = "needs_input"
    blocked = "blocked"
    review = "review"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


TERMINAL_TASK_STATUSES = frozenset({TaskStatus.done, TaskStatus.failed, TaskStatus.cancelled})
OPEN_TASK_STATUSES = frozenset(
    {
        TaskStatus.open,
        TaskStatus.assigned,
        TaskStatus.in_progress,
        TaskStatus.needs_input,
        TaskStatus.blocked,
        TaskStatus.review,
    }
)


class DependencyKind(enum.StrEnum):
    # The only kind in MVP. ``binds`` (below) is where a dependency that also
    # *feeds* its result would go — a chain of runs at the task level.
    finish_to_start = "finish_to_start"


class Task(Base):
    # The table is ``todos`` (task-model-migration §2.1). **M2 takes the name
    # ``tasks`` for the plan node** — the thing the runtime dispatches — and a
    # Todo is what a person writes down, so the two nouns stop sharing a table
    # name here rather than one slice later. Only the name moves in M2: the
    # class, its columns and ``TaskStatus`` are M4's, and nothing derives state
    # yet.
    __tablename__ = "todos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable: a task may live in its graph's "No project" bucket.
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # *Part of* — the parent cannot go `review` while a child is open. Distinct
    # from `todo_dependencies`, which is *after* (§ 6.2a keeps them apart).
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("todos.id", ondelete="CASCADE"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # The goal as prose. **This is the intent an agent plans from** — a
    # task-triggered run starts at *Plan* because the body already is an
    # intent (docs/for-developers/modules/agents/spec.md).
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # What "done" means. Prose in v1; the Verify step reads the result, not this.
    acceptance: Mapped[str] = mapped_column(Text, default="", nullable=False)

    status: Mapped[str] = mapped_column(String(16), default=TaskStatus.open.value, nullable=False, index=True)
    # Polymorphic principal ref: "user" | "agent", or NULL for unassigned.
    assignee_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    assignee_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # The assignee's final statement, pointing at the record rather than
    # restating it: {summary, run_ids[], emitted: [{run_id, seq, kind}]}.
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Why the task is blocked, in words, so the row explains itself.
    blocked_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    @property
    def is_open(self) -> bool:
        return self.status in {s.value for s in OPEN_TASK_STATUSES}


class TaskDependency(Base):
    """*After* — this task may not start until that one is ``done``."""

    __tablename__ = "todo_dependencies"
    __table_args__ = (UniqueConstraint("task_id", "depends_on_id", name="uq_todo_dependency"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("todos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    depends_on_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("todos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(24), default=DependencyKind.finish_to_start.value, nullable=False)
    # Reserved (docs/for-developers/modules/work/spec.mda): a dependency that also *feeds* its result —
    # {"baseline": "${tasks.t2.result.emitted[metric]}"} — is a chain of
    # runs one layer up. Not built; the column keeps it additive (R2, R5).
    binds: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ── Projects ─────────────────────────────────────────────────────────────────


class ProjectStatus(enum.StrEnum):
    active = "active"
    # Tasks freeze read-only; running runs finish rather than being killed.
    archived = "archived"


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("graph_id", "key", name="uq_project_graph_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # URL-safe handle, unique per graph — projects are addressed by key, not id,
    # because a person types them.
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=ProjectStatus.active.value, nullable=False)

    created_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class ProjectAssignment(Base):
    """Staffing — *a default, not a permission* (docs/for-developers/modules/work/spec.md).

    A principal staffed on a project appears in its assignee picker. An agent
    that is *not* staffed may still be assigned explicitly; nothing here grants
    or withholds access, which stays Graph membership's job.
    """

    __tablename__ = "project_assignments"
    __table_args__ = (UniqueConstraint("project_id", "principal_kind", "principal_id", name="uq_project_assignment"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # "user" | "agent" — polymorphic, like every other principal ref (D5).
    principal_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    principal_id: Mapped[str] = mapped_column(String(36), nullable=False)
    assigned_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    assigned_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
