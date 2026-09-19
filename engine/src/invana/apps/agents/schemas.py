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
    # The roster this agent starts with, bound as part of creating it — the same
    # shape as a spawned agent's bindings being named at spawn (BN4). Changing
    # them afterwards goes through `POST/DELETE …/agents/{id}/skills/{skill_id}`,
    # because a bind is a write with its own refusal (BN5 · BN6).
    skill_ids: list[str] = Field(default_factory=list)
    budget: dict[str, Any] = Field(default_factory=dict)
    policy: dict[str, Any] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    workflow_spec: dict[str, Any] | None = None
    llm_config_id: str | None = None
    # No `skill_ids`: binding is not a field of the agent. See AgentCreate.
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
    # Read through `skill_bindings` (BN6). Present here because the roster badge
    # and the bindings picker both need it; not writable on this object.
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
    # Which text this step was actually offered (SK3) — two steps naming the
    # same skill may have read different prose.
    skill_version_id: str
    version: int
    # True when the model reported applying it, not merely that it was offered.
    reported: bool
    finished_at: datetime | None


class SkillUsageVersion(BaseModel):
    """Offered, applied and the gap, for one published version.

    Counts are per version and never summed across them: publishing v4 starts
    its own count and v3 keeps its history
    ([US3](docs/for-developers/modules/skills/features/usage.md)). ``offered``
    is a fact written by prompt assembly; ``applied`` is the model's own report,
    which is why the surface says so rather than implying it away (US4).
    """

    skill_version_id: str
    version: int
    offered: int
    applied: int
    gap: int
    #: False below the floor the engine owns, so every surface draws
    #: *too few to read* at the same point instead of inventing a percentage
    #: ([US6](docs/for-developers/modules/skills/features/usage.md)).
    enough_to_read: bool


class SkillUsageByAgent(BaseModel):
    """Which agents apply it and which never do (C4).

    The agent is the run's, not the step's — a step carries no agent of its own.
    """

    agent_id: str | None
    agent_name: str | None
    offered: int
    applied: int
    gap: int
    enough_to_read: bool


class SkillUsageByOutcome(BaseModel):
    """Applied in runs that served, versus runs that did not (C5).

    ``outcome`` is the **run's** — `answered` · `cannot_answer` · `failed` ·
    `cancelled`, or null on a run that has not settled.
    """

    outcome: str | None
    offered: int
    applied: int
    gap: int
    enough_to_read: bool


class SkillUsageResponse(BaseModel):
    """Everything the Usage tab draws, in one request.

    ``by_agent`` and ``by_outcome`` are for the **current** version: the page
    reads one text at a time, and a breakdown summed across versions would be
    the number US3 exists to prevent.
    """

    skill_id: str
    current_version_id: str | None
    # Newest version first, the same order the version bar reads.
    versions: list[SkillUsageVersion]
    by_agent: list[SkillUsageByAgent] = Field(default_factory=list)
    by_outcome: list[SkillUsageByOutcome] = Field(default_factory=list)
    used_by: list[AgentRead]
    recent_steps: list[SkillUsageStep]


class DefaultAgentRequest(BaseModel):
    agent_id: str
