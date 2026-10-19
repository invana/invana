"""Pydantic request/response models for the Tasks API (docs/for-developers/modules/work/spec.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.skills.schemas import OfferedRule


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    # The goal as prose — this is the intent an agent plans from.
    body: str = Field(default="")
    acceptance: str = Field(default="")
    project_key: str | None = None
    # A branch of that project, by number.
    branch: int | None = Field(default=None, ge=1)
    parent_id: str | None = None
    assignee_kind: str | None = Field(default=None, pattern=r"^(user|agent)$")
    assignee_id: str | None = None
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = None
    acceptance: str | None = None
    project_key: str | None = None
    assignee_kind: str | None = Field(default=None, pattern=r"^(user|agent|none)$")
    assignee_id: str | None = None
    due_at: datetime | None = None


class TaskResultRequest(BaseModel):
    summary: str = Field(default="")
    run_ids: list[str] = Field(default_factory=list)
    emitted: list[dict[str, Any]] = Field(default_factory=list)


class TaskRejectRequest(BaseModel):
    # Becomes a **new Thought** on the same task — append-only, so the timeline
    # shows every round rather than overwriting the last one.
    note: str = Field(default="")


class TaskAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1)


class DependencyCreate(BaseModel):
    depends_on_id: str


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    project_id: str | None
    parent_id: str | None
    branch_id: str | None = None
    title: str
    body: str
    acceptance: str
    status: str
    assignee_kind: str | None
    assignee_id: str | None
    created_by_kind: str
    created_by_id: str | None
    result: dict[str, Any] | None
    blocked_reason: str | None
    due_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    # Resolved for display, so a row needs no second call.
    project_key: str | None = None
    assignee_name: str | None = None
    depends_on: list[str] = []
    blocks: list[str] = []
    sub_task_ids: list[str] = []
    run_ids: list[str] = []


class TaskListResponse(BaseModel):
    items: list[TaskRead]
    total: int
    #: How many of ``items`` are in each status; a status with none is absent.
    by_status: dict[str, int] = Field(default_factory=dict)


class ActivityNode(BaseModel):
    """One row of the § 9.3 tree.

    Two sources, one shape: an ``events`` row (a domain write by anyone) or a
    ``run_nodes`` row (one attempt, with its skills). ``children`` is built
    from ``parent_event_id`` and ``parent_run_id``, never from timestamps.
    """

    id: str
    kind: str  # event · step
    action: str
    label: str
    detail: str = ""
    actor_kind: str | None = None
    actor_id: str | None = None
    actor_name: str | None = None
    on_behalf_of_name: str | None = None
    run_id: str | None = None
    status: str | None = None
    skills_offered: list[str] = []
    skills_applied: list[str] = []
    #: Rules offered by assembly and cited by the model, each as the statement
    #: the step was given, so a citation still reads after a rewording.
    rules_offered: list[OfferedRule] = []
    rules_cited: list[OfferedRule] = []
    tokens_in: int | None = None
    tokens_out: int | None = None
    tokens: int | None = None
    at: datetime | None = None
    children: list[ActivityNode] = []


ActivityNode.model_rebuild()


class TaskActivityResponse(BaseModel):
    task_id: str
    nodes: list[ActivityNode]


# ── Projects ─────────────────────────────────────────────────────────────────


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    # Derived from the name when omitted — a person should not have to invent a
    # slug to write down a piece of work.
    key: str | None = Field(default=None, min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    description: str = Field(default="")
    type: str = Field(default="general", max_length=16)
    question: str = Field(default="")
    visibility: str = Field(default="graph", pattern=r"^(graph|private)$")
    # The first branch; the question, or the name, when omitted.
    first_branch: str | None = Field(default=None, max_length=500)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, pattern=r"^(active|archived)$")
    # Relabels only — nothing stored changes with it.
    type: str | None = Field(default=None, max_length=16)
    question: str | None = None
    visibility: str | None = Field(default=None, pattern=r"^(graph|private)$")


class ProjectWords(BaseModel):
    """The type's words for a branch, evidence, verdicts and decisions."""

    branch: str
    evidence: str
    verdicts: dict[str, str]
    choices: dict[str, str]
    opens_first: list[str]


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    key: str
    name: str
    description: str
    status: str
    type: str = "general"
    question: str = ""
    visibility: str = "graph"
    words: ProjectWords | None = None
    created_by_kind: str
    created_by_id: str | None
    # Who wrote it, resolved for display — the detail's heading says a name, never
    # an id, and falls back to null when that person is gone.
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
    # Counts for the list row's meta line, so the panel needs one call.
    task_count: int = 0
    open_task_count: int = 0


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
    total: int


class AssignmentCreate(BaseModel):
    principal_kind: str = Field(..., pattern=r"^(user|agent)$")
    principal_id: str


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    principal_kind: str
    principal_id: str
    # Resolved for display; null when the principal is gone.
    principal_name: str | None = None
    assigned_at: datetime


class AssignmentListResponse(BaseModel):
    items: list[AssignmentRead]
    total: int


class PlanTaskRead(BaseModel):
    """One task's derived position — the Plan tab's row and the canvas's card."""

    id: str
    title: str
    status: str
    assignee_kind: str | None
    assignee_id: str | None
    assignee_name: str | None
    due_at: datetime | None
    wave: int
    order: int
    blocked_by: list[str]
    critical: bool
    # A cross-project dependency is allowed within a graph and drawn greyed
    # with the other project's key (docs/for-developers/modules/work/spec.mda).
    project_key: str | None = None


class PlanEdge(BaseModel):
    source: str
    target: str


class ProjectPlanResponse(BaseModel):
    project_key: str | None
    tasks: list[PlanTaskRead]
    edges: list[PlanEdge]
    critical_path: list[str]


class ProjectSummary(BaseModel):
    """Every count a project's Overview and its detail's status bar show."""

    #: Every branch, and how many sit in each status; a status with none is absent.
    branches: int = 0
    branches_by_status: dict[str, int] = Field(default_factory=dict)
    findings: int = 0
    #: Findings a person reviewed.
    findings_reviewed: int = 0
    #: Distinct datasets the findings cite, any version.
    datasets: int = 0
    #: The project's own tasks per status; a status with none is absent.
    todos_by_status: dict[str, int] = Field(default_factory=dict)
    #: Tasks not done, failed or cancelled; and of those, assigned to an agent.
    todos_open: int = 0
    todos_open_for_agents: int = 0
    #: Every decision, superseded ones included.
    decisions: int = 0
    #: Length of the plan's critical path.
    critical_path: int = 0


# ── Project records ──────────────────────────────────────────────────────────


class Cite(BaseModel):
    """What a finding rests on: a graph record, a dataset version or a run."""

    kind: str = Field(..., pattern=r"^(record|dataset|run)$")
    # record: the element id · dataset: publisher/name@v · run: the run id.
    ref: str = Field(..., min_length=1, max_length=300)
    version_id: str | None = None


class BranchFork(BaseModel):
    """One child per title."""

    titles: list[str] = Field(..., min_length=1)


class BranchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    number: int
    parent_number: int | None = None
    title: str
    body: str
    status: str
    merged_into_number: int | None = None
    created_by_kind: str
    created_by_id: str | None
    created_at: datetime
    # The balance the branch header shows.
    supports: int = 0
    contradicts: int = 0
    context: int = 0
    current_decision: int | None = None


class BranchListResponse(BaseModel):
    items: list[BranchRead]
    total: int


class FindingCreate(BaseModel):
    statement: str = Field(..., min_length=1)
    stance: str = Field(..., pattern=r"^(supports|contradicts|context)$")
    cites: list[Cite] = []
    # An agent of the Graph the finding is attributed to; it waits for a person's review.
    agent_id: str | None = None


class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    number: int
    branch_number: int | None = None
    statement: str
    stance: str
    cites: list[Cite]
    added_by_kind: str
    added_by_id: str | None
    reviewed_by_id: str | None
    reviewed_at: datetime | None
    created_at: datetime
    # How it reached the branch being read: own · fork · merge.
    via: str | None = None


class FindingListResponse(BaseModel):
    items: list[FindingRead]
    total: int


class DecisionCreate(BaseModel):
    verdict: str = Field(..., pattern=r"^(supported|refuted|inconclusive)$")
    choice: str = Field(..., pattern=r"^(pursue|park|drop|merge)$")
    rationale: str = Field(..., min_length=1)
    # Finding numbers; every finding on the branch when omitted.
    cites: list[int] | None = None
    # The contradicting finding numbers the verdict answers.
    addresses: list[int] = []
    supersedes: int | None = Field(default=None, ge=1)
    # merge only: the branch to carry into, and the finding numbers to carry.
    into: int | None = Field(default=None, ge=1)
    carry: list[int] | None = None


class DecisionCheck(BaseModel):
    rule_id: str
    version: int
    statement: str
    mode: str
    passed: bool
    reason: str | None = None


class DecisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    project_key: str | None = None
    number: int
    branch_number: int | None = None
    verdict: str
    choice: str
    # The type's words for the two.
    verdict_label: str | None = None
    choice_label: str | None = None
    rationale: str
    cites: list[int] = []
    addresses: list[int] = []
    into_number: int | None = None
    supersedes_number: int | None = None
    superseded_by_number: int | None = None
    checks: list[DecisionCheck] = []
    warnings: list[str] = []
    decided_by_id: str | None
    created_at: datetime


class DecisionListResponse(BaseModel):
    items: list[DecisionRead]
    total: int
    #: How many of ``items`` no later decision supersedes.
    current: int = 0


class ProposalCreate(BaseModel):
    agent_id: str
    kind: str = Field(..., pattern=r"^(fork|decision)$")
    rationale: str = Field(..., min_length=1)
    # fork: the child titles.
    titles: list[str] | None = None
    # decision: what the agent suggests a person record.
    decision: DecisionCreate | None = None


class ProposalResolve(BaseModel):
    note: str = ""


class ProposalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    number: int
    branch_number: int | None = None
    kind: str
    payload: dict[str, Any]
    rationale: str
    status: str
    agent_id: str | None
    submitted_by_id: str | None
    resolved_by_id: str | None
    resolved_at: datetime | None
    note: str
    result: dict[str, Any] | None
    created_at: datetime


class ProposalListResponse(BaseModel):
    items: list[ProposalRead]
    total: int


class BranchDetail(BaseModel):
    """The branch page in one call."""

    branch: BranchRead
    findings: list[FindingRead]
    decisions: list[DecisionRead]
    proposals: list[ProposalRead]
    children: list[int]


class ReportDraftUpdate(BaseModel):
    draft: str


class ReportCite(BaseModel):
    ref: str
    version_id: str


class ReportVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version: int
    body: str
    cites: list[ReportCite]
    published_by_id: str | None
    published_at: datetime
    # Cited dataset versions retracted since — read, never stored.
    retracted: list[str] = []


class ReportVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version: int
    published_by_id: str | None
    published_at: datetime


class ReportRead(BaseModel):
    project_key: str
    draft: str
    draft_updated_by_id: str | None = None
    draft_updated_at: datetime | None = None
    versions: list[ReportVersionSummary] = []


# ── Simulation (docs/for-developers/modules/work/features/simulation.md) ─────


class SpecFieldRead(BaseModel):
    """One field a simulator's spec takes."""

    name: str
    type: str
    required: bool
    default: Any = None
    label: str


class SimulatorRead(BaseModel):
    """One installed simulator."""

    key: str
    version: str
    plugin: str
    plugin_version: str
    #: The plugin's short name — what `invana simulate --plugin` takes.
    handle: str
    title: str
    summary: str
    spec: list[SpecFieldRead]


class SimulatorListResponse(BaseModel):
    items: list[SimulatorRead]
    total: int


class SimulationCreate(BaseModel):
    #: A simulator key, `key@version`, or its plugin's short name.
    simulator: str = Field(..., min_length=1, max_length=96)
    spec: dict[str, Any] = Field(default_factory=dict)
    #: `publisher/name@v` of each dataset version it reads.
    inputs: list[str] = Field(default_factory=list, max_length=20)
    seed: int | None = Field(default=None, ge=0, le=2**53)


class SimulationInput(BaseModel):
    """One pinned input."""

    ref: str
    dataset_id: str
    version_id: str
    content_hash: str


class SimulatorRef(BaseModel):
    key: str
    version: str
    plugin: str
    plugin_version: str
    title: str


class SimulationResult(BaseModel):
    ranked: list[dict[str, Any]]
    summary: dict[str, Any]


class SimulationRead(BaseModel):
    number: int
    branch: int
    simulator: SimulatorRef
    spec: dict[str, Any]
    seed: int
    inputs: list[SimulationInput]
    #: A simulation is a prediction, never an observation.
    origin: str = "derived"
    run_id: str | None
    status: str | None
    outcome: str | None = None
    error: str | None = None
    result: SimulationResult | None = None
    tokens: int = 0
    created_by_id: str | None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None


class SimulationListResponse(BaseModel):
    items: list[SimulationRead]
    total: int
