"""The plan and its nodes — ``task_plans`` and ``tasks``
(docs/for-developers/building-engine/task-model-migration.md §2.2 · §2.3).

A **TaskPlan** is the flow that carries work out; a **Task** is one node inside
it. The plan is data *as rows*: YAML is the authoring format and the export
shape, never a second source of truth, which is why the old ``spec``/``dag``
jsonb columns do not survive.

``tasks.task_plan_id`` is ``NOT NULL``, and that constraint **is** the rule
"nothing a person authors is ever a Task": a Task cannot exist without a plan
to belong to. What a person writes down is a **Todo**, and it lives in
``apps/work`` (docs/for-developers/terminology.md §8).
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class PlanOrigin(enum.StrEnum):
    """How a plan came to exist.

    Three of these are the library's badge ([LB5](docs/for-developers/modules/workflows/features/the-library.md));
    ``generated`` is the fourth and is deliberately **not** listed there — a
    one-off plan belongs to its Todo and is read from the run that ran it,
    because browsing plans that can never be selected again makes the library a
    log ([LB6](docs/for-developers/modules/workflows/features/the-library.md)).
    """

    #: Shipped with Invana, re-seeded from the registry at startup.
    builtin = "builtin"
    #: A person drafted and published it.
    authored = "authored"
    #: Drafted by the planner for one Todo. Never listed, never re-selected.
    generated = "generated"
    #: A generated plan that served, was reviewed, and was promoted — the one write.
    promoted = "promoted"


class PlanKind(enum.StrEnum):
    """The plan's **subject** — what the run is about, never a second write path.

    Every kind is walked by the same interpreter and writes the same rows; kind
    is what the journal filters and what a surface renders differently
    ([SR5](docs/for-developers/modules/operate/features/see-what-ran.md)).
    **There is no ``work``** — that distinction is Todo-versus-Task now.
    """

    ask = "ask"
    import_ = "import"
    bulk = "bulk"
    stitch = "stitch"
    model = "model"
    enrich = "enrich"


class TaskForm(enum.StrEnum):
    """What kind of node this is.

    ``callable`` names one closed-catalogue entry; ``composite`` holds children;
    ``human`` is a node only a person can settle — which is how a catalogue gap
    becomes a step rather than a block.
    """

    callable = "callable"
    composite = "composite"
    human = "human"


class TaskPlan(Base):
    __tablename__ = "task_plans"
    __table_args__ = (UniqueConstraint("graph_id", "key", "version", name="uq_task_plan_graph_key_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Unique per Graph, and **null unless reusable** — a one-off plan is named
    #: by the Todo it was drafted for, not by a key nobody will type.
    key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Versions are immutable: promoting a changed shape mints `key@n+1` rather
    # than editing `key@n`, so a promoted plan is diffable against the one it
    # came from (docs/for-developers/modules/agents/spec.md V3).
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default=PlanKind.ask.value, nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(16), default=PlanOrigin.builtin.value, nullable=False, index=True)
    #: Which `intent.kind` values this plan serves — what matches it to a Todo.
    intent: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: Set when `origin = generated`: the Todo this plan was drafted for.
    todo_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("todos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    #: `{name: {type, required, default}}` — what a run of this plan takes.
    args_schema: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: Provenance, N:M — the skill versions this plan was drawn from.
    source_skill_version_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    reusable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    promoted_from_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    @property
    def ref(self) -> str:
        return f"{self.key}@{self.version}"


class Task(Base):
    """One node of a plan — an LLM call, a query, a decision box, a fan-out.

    Never a Todo. A Todo is work a principal owns and a person accepts; a Task
    is what the runtime dispatches ([SR4](docs/for-developers/modules/operate/features/see-what-ran.md)).
    """

    __tablename__ = "tasks"
    __table_args__ = (UniqueConstraint("task_plan_id", "parent_id", "key", name="uq_task_plan_sibling_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    #: **NOT NULL** — see the module docstring. This is the constraint, not a convention.
    task_plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    #: Position among siblings — the order the plan was written in, which is
    #: *not* the order it must run in. `depends_on` is what constrains that.
    ordinal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    #: Unique among siblings. What `${steps.<key>.<output>}` binds against, and
    #: what a log line and a Gantt row both call this node.
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    form: Mapped[str] = mapped_column(String(16), default=TaskForm.callable.value, nullable=False)
    #: Callable only, and only from the closed catalogue.
    step_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    args: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    assignee_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    assignee_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # ── The plan grammar, on the node ──────────────────────────────────────
    #: Sibling keys that must settle first. **Materialised**, never inferred at
    #: read time: an order derived on every read is an order nobody reviewed.
    depends_on: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    when: Mapped[str | None] = mapped_column(Text, nullable=True)
    map_over: Mapped[str | None] = mapped_column(Text, nullable=True)
    loop: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    approval: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timeout_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retry: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    max_parallel: Mapped[int | None] = mapped_column(Integer, nullable=True)
    on_lane_failure: Mapped[str | None] = mapped_column(String(24), nullable=True)

    #: The prose this node was drawn from — null when hand-authored.
    source_span: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
