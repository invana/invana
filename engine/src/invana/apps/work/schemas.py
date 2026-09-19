"""Pydantic request/response models for the Tasks API (docs/for-developers/modules/work/spec.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    # The goal as prose — this is the intent an agent plans from.
    body: str = Field(default="")
    acceptance: str = Field(default="")
    project_key: str | None = None
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
    #: The statements this step cited, resolved to the wording it was offered —
    #: a citation must still read after the rule is reworded or deactivated.
    rules_cited: list[str] = []
    tokens_in: int | None = None
    tokens_out: int | None = None
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


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, pattern=r"^(active|archived)$")


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    key: str
    name: str
    description: str
    status: str
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
