"""SQLAlchemy models for task_runs · task_stream · task_prompts
(docs/for-developers/building-engine/task-model-migration.md §2.4, §2.5).

``task_runs`` is **one table**. A run with no ``parent_run_id`` is what a Todo
or a session ask opened; a run with one is a node of that run's plan. They were
``runs`` and ``run_nodes`` — the same fact at two resolutions, which
meant every question about *what ran* was asked twice and stitched. The ask
folds in as well: ``runs`` was a row every root run had exactly one of.

``task_stream`` is the append-only log Studio tails: persist first, then
broadcast; every subscription takes ``after=<seq>`` so a reload replays from the
record. ``task_prompts`` is what a run asked and what came back.

Every JSON column is ``sqlalchemy.JSON`` (never JSONB) so SQLite dev keeps
working; ids are ``String(36)`` UUIDs like every other table.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class TriggeredBy(enum.StrEnum):
    """What opened this run (docs/for-developers/modules/agents/spec.md Q1's enum, +
    docs/for-developers/modules/work/spec.md's task trigger)."""

    user = "user"
    schedule = "schedule"
    # An assignment, or the last dependency closing. Either way the trace reads
    # the same, which is the point of using one trigger for both.
    task = "task"
    # A parent node's `delegate` (docs/for-developers/modules/work/spec.md).
    delegation = "delegation"


class RunStatus(enum.StrEnum):
    """How a run is going — one enum where there were two.

    A step and a run were described by `RunStatus` and `RunStatus` saying
    mostly the same words; `RunStatus` is gone and these are the union.
    `run` is not among them: it is a retired word (terminology.md §8) and
    the state it named is `running`, which is what a step already called it.
    """

    queued = "queued"
    running = "running"
    awaiting_input = "awaiting_input"
    needs_input = "needs_input"
    succeeded = "succeeded"
    failed = "failed"
    stopped = "stopped"
    skipped = "skipped"
    cancelled = "cancelled"


TERMINAL_RUN_STATUSES = frozenset(
    {RunStatus.succeeded, RunStatus.failed, RunStatus.cancelled, RunStatus.awaiting_input}
)


class RunRole(enum.StrEnum):
    """What a run is *for* — the axis `status` never carried.

    Orthogonal to depth: a root run and a child run both have a role, and a
    plan node that plans is `plan` whether or not anything delegated to it.
    """

    execute = "execute"
    plan = "plan"
    evaluate = "evaluate"


class PromptKind(enum.StrEnum):
    """Why a run stopped to ask (task-model-migration §2.5)."""

    clarification = "clarification"
    approval = "approval"
    verdict = "verdict"


class TaskRun(Base):
    """One execution — of a whole plan, or of one node in it.

    **There is no step table.** A `TaskRun` and a `TaskRun` were the same
    fact at two resolutions, and keeping them apart meant every question about
    *what ran* had to be asked twice and stitched. A run with no
    ``parent_run_id`` is what a Todo or a session ask opened; a run with one is
    a node of that run's plan, and a delegated child is a node whose own
    ``parent_run_id`` points at the node that delegated it. One table, one
    vocabulary, one recursion (task-model-migration.md §2.4).

    **The ask folds in here too.** ``runs`` was a second row that every
    root run had exactly one of, so ``body`` · ``params`` · ``ask_kind`` and the
    session pair live on the root. They are null on a child, which is the
    honest shape: a child run is not an ask.
    """

    __tablename__ = "task_runs"
    __table_args__ = (
        # A node runs once per (lane, iteration, attempt) under its parent. The
        # root of a run has no parent and no lane, so it is excluded rather
        # than squeezed into the same uniqueness.
        UniqueConstraint("parent_run_id", "task_id", "lane", "iteration", "attempt", name="uq_task_run_attempt"),
        # *$1.84 of $40.00 this month* is a windowed ``SUM(cost_usd)`` per agent
        # ([§ 5.1](docs/for-developers/building-engine/govern-and-agents-data-model.md)),
        # never a counter column — a counter can disagree with the runs it
        # counts. Without the second column the window is a scan of every run
        # the agent has ever done.
        Index("ix_task_runs_agent_started", "agent_id", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── the tree ─────────────────────────────────────────────────────────────
    #: Null on the run a person or a schedule opened; set on every node of its
    #: plan, and on a delegated child (whose parent is the delegating node).
    #: `child_run_id` is **not here**: a delegating node's children are the
    #: rows that name it here, so the column duplicated the edge it sat on.
    parent_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    #: The Todo this run carries out, when it is carrying one out.
    todo_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    #: The plan being run (root) — its rows are what the nodes execute.
    task_plan_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("task_plans.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: The plan **node** this run executes. Null on a root, and on a node whose
    #: plan was generated rather than drawn from the library.
    task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    role: Mapped[str] = mapped_column(String(16), default=RunRole.execute.value, nullable=False, index=True)

    # ── what ran ─────────────────────────────────────────────────────────────
    #: The catalogue entry this node names. Empty on a root, which names a plan.
    task_key: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    #: The plan's own id for this node ("execute_a") — what `${steps.X.y}` binds.
    step_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    label: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    #: Position among its siblings; the resume cursor counts in these.
    seq: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lane: Mapped[str | None] = mapped_column(String(64), nullable=True)
    iteration: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # ── the plan, frozen ─────────────────────────────────────────────────────
    #: Which built-in flow answers this run — what the interpreter dispatches
    #: on. Distinct from `plan_origin`, which is provenance: a run off
    #: `nl-query` whose Plan step picks `nl-single@1` has both, and they answer
    #: different questions.
    workflow_key: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    #: The flow as it ran. **Not `plan`** — that word names four things.
    plan_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    #: `authored:<id>` · `generated` · `reused:<id>` · `template:<key>@<v>`.
    plan_origin: Mapped[str | None] = mapped_column(String(64), nullable=True)
    plan_revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── the world it ran against ─────────────────────────────────────────────
    lens_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    lens_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # ── the ask, folded in from `runs` (§7b) ─────────────────────────────
    #: `nl` · `ql` · `import`. Null on a child: a node is not an ask.
    ask_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The composer's knobs — language, provider, timeout, parameters.
    params: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    #: The user message the ask was posed on.
    message_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True
    )
    author_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)

    # ── who ran it ───────────────────────────────────────────────────────────
    agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    agent_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    triggered_by: Mapped[str] = mapped_column(String(16), default=TriggeredBy.user.value, nullable=False)
    on_behalf_of_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # ── state ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(16), default=RunStatus.queued.value, nullable=False, index=True)
    outcome: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: The assistant reply this run settles into.
    assistant_message_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Where to re-enter on resume: {"step": <index>}.
    cursor: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    stream_seq: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clarifications: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    replans: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ── what it produced ─────────────────────────────────────────────────────
    #: The one-liner the row shows ("proposed Cypher · 5 lines").
    detail: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    #: Resolved args this attempt ran with, envelope pins included.
    args: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    input: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    #: `result.json` (SR17) — status, outputs, artifacts, timing. A run's own is
    #: the merge of its nodes'.
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: What this row spent, in dollars — tokens x the model's published rate,
    #: derived when the row settles (SR40). ``NULL`` means *the price is not
    #: known*, which is not `0`: an unpriced model draws no Cost tile rather
    #: than a free one (observability.md OB4).
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    #: A fact (what the prompt carried) and a self-report (what the model said
    #: it used) — two lists because they are two certainties.
    skills_offered: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    skills_applied: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: The same two certainties for rules (RU7): `rule_version_id`s assembly put
    #: in the prompt, and the ones the model says it followed. Without the first,
    #: *never cited* cannot be told from *never offered*.
    rules_offered: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    rules_cited: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class TaskStream(Base):
    """Append-only emission log for one run — persist first, then broadcast."""

    __tablename__ = "task_stream"
    __table_args__ = (UniqueConstraint("run_id", "seq", name="uq_task_stream_seq"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    idem_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class TaskPrompt(Base):
    """What a run asked, and what came back (task-model-migration §2.5).

    ``kind`` is the axis `prompt_answers` lacked: a clarification is answered
    by a person only, an approval is a gate, and a verdict may come from either
    — one table, told apart by what was asked rather than by which surface asked.
    """

    __tablename__ = "task_prompts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default=PromptKind.clarification.value, nullable=False)
    #: What was offered, so the answer replays against the same choices.
    options: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: How long the run waits before the prompt's default applies.
    deadline_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    template_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    answered_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    answered_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    #: The chosen option's id and value — never the label, so it replays.
    value: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Emission(Base):
    __tablename__ = "emissions"
    __table_args__ = (UniqueConstraint("run_id", "seq", name="uq_emission_seq"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The reply this emission belongs to, so a thread renders without a join walk.
    message_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Which node produced it — the trace's own row, for "where did this come
    # from". A run id now, like everything else that names a step.
    step_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    # subgraph | table | metric | chart | prose | empty. Declared, never inferred.
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    # The body, in the shape that kind renders from.
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # The template that chose the rendering. NULL means the kind's default — and
    # the header says so rather than being filled in to look complete (AS9).
    template_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # The query and the records behind it (AS3): {"query": …, "record_count": n,
    # "query_language": …}. Never empty — an emission with no citation is refused
    # at production, not rendered without one.
    citation: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ---------------------------------------------------------------------------
# Projection templates and the answers to prompts
# (docs/for-developers/modules/ask/features/projections.md)
#
# A projection is a declared mapping from a shape to a surface, and it runs in
# both directions: how a question is put to a person, and how records are shown
# to one. The template owns the markup; the step supplies values (P1) — the same
# reason a plan is validated against an envelope.
# ---------------------------------------------------------------------------


class ProjectionTemplate(Base):
    __tablename__ = "projection_templates"
    __table_args__ = (UniqueConstraint("graph_id", "name", "version", name="uq_projection_template_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    # NULL for the templates shipped with the distribution — every Graph has them,
    # and none of them is anybody's row to edit.
    graph_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # prompt = asking a person something; result = showing them records.
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    # choice · multi-choice · boolean · pick-from-graph · value · confirm
    # table · metric · chart · subgraph · markdown · html
    surface: Mapped[str] = mapped_column(String(24), nullable=False)
    # The shape it can render: required fields and their types. Checked *before*
    # render, so a missing field is refused by name rather than drawn half-empty (P4).
    accepts: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # The surface's own definition — columns for a table, axes for a chart, the
    # option source for a choice.
    spec: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # What it is for, so `project` selects it the way `plan` selects a workflow.
    intent: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="published", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
