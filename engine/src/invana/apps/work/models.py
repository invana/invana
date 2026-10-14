"""SQLAlchemy models for Work — ``projects``, ``project_assignments``, ``tasks``
and ``task_dependencies`` (docs/for-developers/modules/work/spec.md), and the
records a quest is made of — branches, findings, decisions, proposals and the
report (docs/for-developers/modules/work/features/branches-and-decisions.md,
project-reports.md), and the handle a branch keeps on a simulator run
(simulation.md).

`projects` folded in here at migration-plan §17 step 6: the two packages held
one idea and imported each other. Table names are unchanged, so no migration.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    # A branch of the todo's own project; open todos stay on a branch when it forks.
    branch_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="SET NULL"), nullable=True, index=True
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


class ProjectVisibility(enum.StrEnum):
    graph = "graph"
    # Only the principals staffed on it see it.
    private = "private"


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
    # Sets the words the project speaks in; the stored records never change with it.
    type: Mapped[str] = mapped_column(String(16), default="general", nullable=False)
    # The one question the project is deciding.
    question: Mapped[str] = mapped_column(Text, default="", nullable=False)
    visibility: Mapped[str] = mapped_column(String(16), default=ProjectVisibility.graph.value, nullable=False)

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


# ── Project records ──────────────────────────────────────────────────────────


class BranchStatus(enum.StrEnum):
    open = "open"
    pursuing = "pursuing"
    parked = "parked"
    dropped = "dropped"
    merged = "merged"


CLOSED_BRANCH_STATUSES = frozenset({BranchStatus.dropped, BranchStatus.merged})


class Stance(enum.StrEnum):
    supports = "supports"
    contradicts = "contradicts"
    context = "context"


class Verdict(enum.StrEnum):
    """The canonical verdict words; a project type relabels them on the way out."""

    supported = "supported"
    refuted = "refuted"
    inconclusive = "inconclusive"


class Choice(enum.StrEnum):
    """The canonical decision words; ``merge`` is a decision in every type."""

    pursue = "pursue"
    park = "park"
    drop = "drop"
    merge = "merge"


# What each decision does to its branch.
STATUS_AFTER: dict[str, str] = {
    Choice.pursue: BranchStatus.pursuing,
    Choice.park: BranchStatus.parked,
    Choice.drop: BranchStatus.dropped,
    Choice.merge: BranchStatus.merged,
}


class FindingVia(enum.StrEnum):
    own = "own"
    fork = "fork"
    merge = "merge"


class ProposalKind(enum.StrEnum):
    fork = "fork"
    decision = "decision"


class ProposalStatus(enum.StrEnum):
    open = "open"
    accepted = "accepted"
    rejected = "rejected"


class ProjectBranch(Base):
    """One line of inquiry. Its status is written by its decisions alone."""

    __tablename__ = "project_branches"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_project_branch_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Per project, because people type it.
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # The hypothesis, option or lead, in a line.
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=BranchStatus.open.value, nullable=False)
    merged_into_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="SET NULL"), nullable=True
    )
    created_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class ProjectFinding(Base):
    """One piece of evidence, added on one branch and linked to others by fork and merge."""

    __tablename__ = "project_findings"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_project_finding_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    stance: Mapped[str] = mapped_column(String(16), nullable=False)
    # [{kind: record|dataset|run, ref, version_id?}]; a dataset cite resolves on add.
    cites: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    added_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    added_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # The person who reviewed it; an agent's finding waits for one.
    reviewed_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class BranchFinding(Base):
    """A finding counted on a branch — its own, inherited by fork, or carried by merge."""

    __tablename__ = "branch_findings"
    __table_args__ = (UniqueConstraint("branch_id", "finding_id", name="uq_branch_finding"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    branch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    finding_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    via: Mapped[str] = mapped_column(String(8), default=FindingVia.own.value, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class ProjectDecision(Base):
    """A person's verdict and decision on a branch. Append-only; a later one supersedes."""

    __tablename__ = "project_decisions"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_project_decision_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    verdict: Mapped[str] = mapped_column(String(16), nullable=False)
    choice: Mapped[str] = mapped_column(String(16), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    # Finding ids it rests on, and the contradicting ones it answers.
    cites: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    addresses: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    into_branch_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="SET NULL"), nullable=True
    )
    supersedes_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("project_decisions.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    # The rules it was checked against: [{rule_id, version, statement, mode, passed, reason}].
    checks: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    warnings: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    decided_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class ProjectProposal(Base):
    """An agent's suggested fork or decision; a person accepts or rejects it."""

    __tablename__ = "project_proposals"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_project_proposal_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    # fork: {titles}; decision: the decide payload.
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=ProposalStatus.open.value, nullable=False, index=True)
    agent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    # The signed-in principal that sent it on the agent's behalf.
    submitted_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    resolved_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # What accepting made: {branches: [n…]} or {decision: n}.
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class ProjectReport(Base):
    """A project's one report: the draft, and the versions published from it."""

    __tablename__ = "project_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    draft: Mapped[str] = mapped_column(Text, default="", nullable=False)
    draft_updated_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    draft_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProjectReportVersion(Base):
    """One published version — a frozen body and the dataset versions it cites."""

    __tablename__ = "project_report_versions"
    __table_args__ = (UniqueConstraint("report_id", "version", name="uq_project_report_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    report_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # [{ref: publisher/name@v, version_id}]
    cites: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    published_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class ProjectSimulation(Base):
    """A branch's handle on one simulator run: what it asked, over which pinned inputs.

    The result is not stored here — it is the simulator step's output on the run.
    """

    __tablename__ = "project_simulations"
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_project_simulation_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    branch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("project_branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    # The simulator's task type key and version, and the plugin that declared it.
    simulator: Mapped[str] = mapped_column(String(64), nullable=False)
    simulator_version: Mapped[str] = mapped_column(String(32), nullable=False)
    plugin: Mapped[str] = mapped_column(String(128), nullable=False)
    plugin_version: Mapped[str] = mapped_column(String(32), nullable=False)
    spec: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # [{ref: publisher/name@v, dataset_id, version_id, content_hash}]
    inputs: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
