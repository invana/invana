"""Pydantic request/response shapes for the workflow library."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AgentChip(BaseModel):
    id: str
    name: str
    status: str


class PlanLayerRead(BaseModel):
    """One governed band, and what a plan declares in it.

    Every band is sent, touched or not
    ([LB22](docs/for-developers/modules/workflows/features/the-library.md)) —
    *this plan reads no graph data* is the fact a reader is checking for, and a
    band that vanished when empty would make it indistinguishable from *nothing
    loaded*.
    """

    #: The reader's spelling — `graph data`, never `graph_data`.
    layer: str
    declared: bool
    steps: int
    #: What the band amounts to in the reader's words, or `—` when it is empty.
    #: Phrased here rather than in Studio, for the reason the band mapping is
    #: (:mod:`invana.runtime.layers`).
    summary: str


class PlanCallerRead(BaseModel):
    """A caller that inlined this plan, and what it tuned
    ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).

    Tuning is a property of the **call**, recorded on the calling plan — so
    this is read off ``task_plans.uses`` and never off this plan, which is
    untouched by any of them.
    """

    #: `skill` when a skill version owns the calling plan, `plan` when nothing does.
    kind: str
    name: str
    skill_id: str | None = None
    #: The version of *this* plan the caller inlined. Below the current one
    #: means the library has moved on since — which a surface **says** and
    #: never acts on ([SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    version: int
    args: dict = {}


class TaskPlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str | None
    version: int
    name: str
    description: str
    kind: str
    # `builtin · authored · promoted` are the library's badge; `generated` is
    # the fourth and is never listed ([LB5](docs/for-developers/modules/workflows/features/the-library.md) · LB6).
    origin: str
    intent: list[str]
    reusable: bool
    todo_id: str | None
    promoted_from_run_id: str | None
    used_by: list[AgentChip] = []
    step_count: int = 0
    # Runs, and of those the ones a *Verify* step called served. A rate with no
    # verified run behind it is `null`, never 0% — "never asked" and "asked and
    # failed" are different facts (docs/for-developers/modules/agents/spec.md).
    runs: int = 0
    served_rate: float | None = None
    last_run_at: str | None = None
    #: The bands this plan touches, in the strip's order — the row's chips.
    layers: list[str] = []
    #: How many callers inline it ([LB19](docs/for-developers/modules/workflows/features/the-library.md)).
    #: The row reads *used by 2 skills* where there are callers and falls back
    #: to how often it ran where there are none.
    caller_count: int = 0


class TaskPlanListResponse(BaseModel):
    items: list[TaskPlanRead]
    total: int
    # Studio renders this verbatim in the panel's status bar. Stating the
    # deferral is the design (docs/for-developers/modules/explore/features/selection-and-the-panel.md, *not a gap*).
    authoring: str = "post-MVP"


class DagNode(BaseModel):
    id: str
    task: str
    label: str
    args: dict
    #: `callable` · `composite` · `human` — what kind of node this is, which is
    #: what makes `4 callables, 1 human` answerable without a second read.
    form: str = "callable"
    #: The band this node sits in, spelled for a reader (:mod:`invana.runtime.layers`).
    layer: str = "agent"
    # Longest path from a root — the column the canvas draws this step in.
    # Two steps at the same depth are independent, which is the whole point of
    # drawing a partial order instead of the stored list.
    depth: int = 0
    # Which of this step's args the envelope fixed — as a **count**, never as a
    # claim: a pin lives on one agent's envelope, and a library entry is used
    # by N (docs/for-developers/modules/explore/features/selection-and-the-panel.md).
    pinned: list[str] = []
    pinned_by_count: int = 0
    pinned_by: list[AgentChip] = []


class DagEdge(BaseModel):
    source: str
    target: str
    # "order" (required sequence) or "binding" (${steps.X.y} feeds this step).
    kind: str
    label: str = ""


class TaskPlanDetail(TaskPlanRead):
    nodes: list[DagNode] = []
    edges: list[DagEdge] = []
    #: The five governed bands, each with what this plan declares in it.
    declared_layers: list[PlanLayerRead] = []
    #: Who inlines it, and what each tuned.
    callers: list[PlanCallerRead] = []
    #: `{name: {type, default, label}}` — what a caller may tune (LB20).
    args_schema: dict = {}


class TasksResponse(BaseModel):
    """What ``/{key}/tasks`` answers — the plan *is* its tasks (§4)."""

    nodes: list[DagNode] = []
    edges: list[DagEdge] = []


class RunRow(BaseModel):
    run_id: str
    status: str
    served: str | None
    started_at: str | None


class PromoteRequest(BaseModel):
    run_id: str
    key: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    description: str = ""
    intents: list[str] = Field(default_factory=list)
