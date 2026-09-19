"""Pydantic request/response models for the Agents API (docs/for-developers/modules/work/spec.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    instructions: str = Field(default="")
    # Start from a seeded agent's envelope rather than an empty one — a blank
    # allow-list is an agent that can do nothing, which is never what is meant.
    envelope_from: str | None = Field(default=None, description="Seeded agent key to copy the envelope from.")
    workflow_spec: dict[str, Any] | None = None
    llm_config_id: str | None = None
    skill_ids: list[str] = Field(default_factory=list)
    budget: dict[str, Any] = Field(default_factory=dict)
    policy: dict[str, Any] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    workflow_spec: dict[str, Any] | None = None
    llm_config_id: str | None = None
    skill_ids: list[str] | None = None
    budget: dict[str, Any] | None = None
    policy: dict[str, Any] | None = None


class AgentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    key: str | None
    name: str
    description: str
    kind: str
    status: str
    lifetime: str
    instructions: str
    workflow_spec: dict[str, Any]
    llm_config_id: str | None
    skill_ids: list[str]
    budget: dict[str, Any]
    policy: dict[str, Any]
    parent_agent_id: str | None
    spawned_in_run_id: str | None
    version: int
    created_by_kind: str
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class AgentListResponse(BaseModel):
    items: list[AgentRead]
    total: int
    # The graph's default agent — what a new session binds when nothing is picked.
    default_agent_id: str | None = None


class AgentNode(BaseModel):
    """One node on the lineage canvas. Heterogeneous by design
    (docs/for-developers/modules/agents/features/lineage.md)."""

    id: str
    kind: str  # agent · user · task
    label: str
    # agent-only
    agent_kind: str | None = None
    status: str | None = None
    lifetime: str | None = None


class AgentEdge(BaseModel):
    """One causal hop. Selecting it is the point of the trace
    (docs/for-developers/modules/agents/features/lineage.md)."""

    id: str
    source: str
    target: str
    # authored · spawned · delegated_for · assigned
    kind: str
    label: str
    event_id: str | None = None


class AgentLineageResponse(BaseModel):
    agent_id: str
    nodes: list[AgentNode]
    edges: list[AgentEdge]


class RetireRequest(BaseModel):
    # Where the agent's open tasks go. None leaves them `blocked` (docs/for-developers/modules/work/spec.md).
    reassign_to_kind: str | None = None
    reassign_to_id: str | None = None


class RetirePreview(BaseModel):
    """What `Retire` has to name before it happens — the open tasks."""

    agent_id: str
    open_task_ids: list[str]
    open_task_titles: list[str]
    session_count: int


class SkillUsageStep(BaseModel):
    run_id: str
    step_id: str
    label: str
    task_key: str
    # True when the model reported applying it, not merely that it was offered.
    reported: bool
    finished_at: datetime | None


class SkillUsageResponse(BaseModel):
    skill_id: str
    used_by: list[AgentRead]
    recent_steps: list[SkillUsageStep]


class DefaultAgentRequest(BaseModel):
    agent_id: str
