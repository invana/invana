"""Pydantic request/response shapes for the workflow library."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AgentChip(BaseModel):
    id: str
    name: str
    status: str


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
