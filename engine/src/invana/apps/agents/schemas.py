"""Pydantic request/response models for the Agents API (docs/for-developers/modules/work/spec.md)."""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.agents.models import AgentKind, AgentStatus
from invana.core.lists import Filter, ListSpec, Page


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    instructions: str = Field(default="")
    # Start from a seeded agent's envelope rather than an empty one — a blank
    # allow-list is an agent that can do nothing, which is never what is meant.
    envelope_from: str | None = Field(default=None, description="Seeded agent key to copy the envelope from.")
    workflow_spec: dict[str, Any] | None = None
    # The skills this agent starts with, bound as part of creating it — the same
    # shape as a spawned agent's bindings being named at spawn (BN4). Changing
    # them afterwards goes through `POST/DELETE …/agents/{id}/skills/{skill_id}`,
    # because a bind is a write with its own refusal (BN5 · BN6).
    skill_ids: list[str] = Field(default_factory=list)
    budget: dict[str, Any] = Field(default_factory=dict)
    effort: dict[str, int] = Field(default_factory=dict)
    policy: dict[str, Any] = Field(default_factory=dict)
    # Empty is Invana's default voice (SO3). The dials are checked against their
    # vocabulary by the manager, which names what it refused (AG16).
    soul: str = Field(default="")
    soul_traits: dict[str, str] = Field(default_factory=dict)
    #: ``llm/<provider>/<model id>``; null lets the cast decide.
    model_pin: str | None = Field(default=None, max_length=255)


class AgentMakeLive(BaseModel):
    """*Create agent* — the draft becomes active through its eval gate."""

    #: Required only when the gate warned.
    why: str | None = Field(default=None, max_length=500)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    workflow_spec: dict[str, Any] | None = None
    # No `skill_ids`: binding is not a field of the agent. See AgentCreate.
    budget: dict[str, Any] | None = None
    effort: dict[str, int] | None = None
    policy: dict[str, Any] | None = None
    # Read by set-ness: `""` clears the soul back to the default voice, `None`
    # leaves it alone.
    soul: str | None = None
    soul_traits: dict[str, str] | None = None
    #: Read by set-ness: an address pins the model, ``null`` hands it back to the cast.
    model_pin: str | None = Field(default=None, max_length=255)
    #: Why — carried on the event that mints the version, never inferred.
    why: str | None = Field(default=None, max_length=500)


class AgentDraftWrite(BaseModel):
    """The agent's unpublished instructions, written whole."""

    instructions: str


class AgentPublish(BaseModel):
    #: Why — carried on the ``agent.update`` the publish writes.
    why: str | None = Field(default=None, max_length=500)


class AgentRollback(BaseModel):
    """Restore the instructions as they were at an earlier agent version."""

    version: int = Field(ge=1)
    why: str | None = Field(default=None, max_length=500)


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
    #: Unpublished instructions; null is no draft open.
    instructions_draft: str | None = None
    workflow_spec: dict[str, Any]
    # Read through `skill_bindings` (BN6). Present here because the skills badge
    # and the bindings picker both need it; not writable on this object.
    skill_ids: list[str]
    # The agent's own guardrail, scoped `agent:<id>` (AG10 · AG26). The name
    # rides with the id because the Overview draws it and a list that has to
    # resolve ids to names draws none of them. Null is *none of its own*.
    guardrail_id: str | None = None
    guardrail_name: str | None = None
    budget: dict[str, Any]
    #: The model address this agent thinks with; null lets the cast decide.
    model_pin: str | None = None
    #: As stored — a missing key is the default. ``effective_effort`` is what a
    #: run reads, with the one-release fallbacks filled in (EB9).
    effort: dict[str, Any]
    effective_effort: dict[str, int]
    #: Whether an Explorer ask may run through it — what decides whether
    #: *Make default* is offered (AG3 · WQ5). Read off the envelope, never set.
    answers_asks: bool
    policy: dict[str, Any]
    soul: str
    soul_traits: dict[str, str]
    parent_agent_id: str | None
    spawned_in_run_id: str | None
    version: int
    created_by_kind: str
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


#: What the Agents list takes. With no ``status`` a retired agent is left out;
#: with no ``ephemeral=shown`` a spawned helper is.
AGENT_LIST = ListSpec(
    filters={
        "kind": Filter(values=tuple(k.value for k in AgentKind)),
        "status": Filter(values=tuple(s.value for s in AgentStatus)),
        "ephemeral": Filter(values=("shown",)),
    },
    sorts=("name", "-created_at", "-updated_at"),
    search_title="name",
)


class AgentPage(Page[AgentRead]):
    #: The Graph's agents that are not retired, by lifetime: the standing
    #: agents, and the spawned helpers the list hides by default.
    persistent: int = 0
    ephemeral: int = 0
    #: ``{agent_id: tokens}`` since the first of the month — what the list draws
    #: against ``max_tokens_month``. A **sidecar map, not a field on the agent**:
    #: it is a grouped read over ``task_runs``, which this band may not touch.
    #: An agent with no run is absent and reads ``0``.
    tokens_this_month: dict[str, int] = Field(default_factory=dict)
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


class LifecycleAct(enum.StrEnum):
    """The two acts that disturb open work. Resume takes nothing away, so it has
    no preview ([LC10](docs/for-developers/modules/agents/features/lifecycle.md))."""

    pause = "pause"
    retire = "retire"


class LifecycleEffect(enum.StrEnum):
    """What an act does to one piece of open work.

    A closed vocabulary, because a sentence per row is a sentence nobody can
    compare ([LC9](docs/for-developers/modules/agents/features/lifecycle.md)).
    """

    #: A run already queued or running. Neither act kills one.
    finishes = "finishes"
    #: An open todo, with the agent named in ``blocked_reason``.
    blocked = "blocked"
    #: A todo in ``review`` under a pause — the one item the two acts disagree
    #: about, and the one a count could never show.
    unchanged = "unchanged"
    #: A thread bound to this agent: its next ask is a 409 naming the state,
    #: never a silent switch to another mind.
    refused = "refused"


class LifecycleItem(BaseModel):
    """One piece of open work, and what the act would do to it."""

    #: ``run`` · ``task`` · ``session``
    kind: str
    id: str
    title: str
    effect: LifecycleEffect
    #: The effect in a reader's words — short, and about *this* item.
    note: str


class LifecyclePreview(BaseModel):
    """What `Pause` or `Retire` has to name before it happens.

    One shape for both acts ([LC8](docs/for-developers/modules/agents/features/lifecycle.md)):
    the same open work, carrying the effect *this* act would have on it.
    """

    agent_id: str
    act: LifecycleAct
    items: list[LifecycleItem]


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
    #: Applied over offered; null below that floor, so no surface shows a share it cannot read.
    applied_rate: float | None = None


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

    ``outcome`` is the **run's** — `answered` · `conversed` · `cannot_answer` ·
    `failed` · `cancelled`, or null on a run that has not settled.
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


class AgentSkillRow(BaseModel):
    """One bound skill, and the callables its current plan names (C12)."""

    skill_id: str
    name: str
    #: The current version's number — a binding does not pin (BN6). Null for a
    #: skill with no published version, which is offered nothing yet.
    version: int | None
    when_to_use: str
    #: Derived from the current version's plan, `uses` already inlined — never
    #: typed (AG15). In plan order, each once.
    needs: list[str]
    #: The library plans that plan inlined, as `key@version`.
    uses: list[str] = Field(default_factory=list)
    #: The `needs` this agent's envelope does not allow — the row marks them
    #: before any run is refused.
    missing: list[str] = Field(default_factory=list)
    #: This agent's runs only, for the current version (US3).
    offered: int = 0
    applied: int = 0
    enough_to_read: bool = False


class AgentCallableRow(BaseModel):
    """One callable the envelope allows (C12)."""

    step_key: str
    #: The one bound it spends — `graph_read` · `llm` · `none` … — or `unknown`
    #: for a key the catalogue no longer has.
    bound: str
    #: The arguments fixed for this agent, or empty.
    pinned: dict[str, Any] = Field(default_factory=dict)
    #: Skill ids and base-plan refs (`key@version`) whose plan names it. Empty is
    #: *nothing bound* — allowed, and a candidate for tightening (EB5).
    needed_by: list[str] = Field(default_factory=list)


class AgentSkillsAndCallables(BaseModel):
    """Both tables of *What this agent can do*, in one read."""

    agent_id: str
    skills: list[AgentSkillRow]
    callables: list[AgentCallableRow]
    #: The base plans a Plan step may pick, as `key@version` — the envelope's
    #: `templates`, resolved to the newest version the Graph holds.
    plans: list[str] = Field(default_factory=list)
    #: Σ the skills' offered and applied, this agent's runs, each on its current version.
    offered: int = 0
    applied: int = 0
    #: Characters every ask carries for the published bound skills — their
    #: current text and *when to use*. A draft is offered nothing and adds none.
    prompt_chars: int = 0


class SoulPreviewRequest(BaseModel):
    """The draft voice, and the ask to hear it on (SO7)."""

    ask: str = Field(..., min_length=1, max_length=2000)
    soul: str = Field(default="")
    soul_traits: dict[str, str] = Field(default_factory=dict)


class SoulPreviewResponse(BaseModel):
    """One ask, answered twice. Neither reply read the graph — a voice is being
    judged, not an answer."""

    ask: str
    current: str
    draft: str
    #: `llm/<provider>/<model>` — what spoke, so the preview is not anonymous.
    model: str | None = None


class AgentOverviewDay(BaseModel):
    """One UTC calendar day of the window — every day present, a quiet one at zero."""

    date: date
    runs: int
    tokens: int


class AgentOverviewExit(BaseModel):
    """How this agent's runs ended, one row per exit, the most frequent first."""

    #: The run's ``outcome`` when it has one, else its ``status``.
    exit: str
    runs: int
    #: The newest run that ended this way.
    last_run_id: str
    last_title: str


class AgentOverviewRun(BaseModel):
    """One of the agent's newest root runs."""

    id: str
    title: str
    #: This agent plus each distinct agent a step of the run delegated to.
    agents: int
    #: The run's own spend plus its steps'.
    tokens: int
    duration_ms: int | None = None
    exit: str
    finished_at: datetime | None = None


class AgentOverviewModel(BaseModel):
    """One model version this agent's runs called, over the window."""

    model_version: str
    #: The first time any of this agent's runs called it, whatever the window.
    first_at: datetime
    runs: int
    #: Served over the runs Verify gave a verdict; null when none did.
    served_rate: float | None = None
    p95_ms: float | None = None


class AgentOverview(BaseModel):
    """A live agent's Overview, over its root runs in the window and the one before.

    The window ends today (UTC) and is ``days`` calendar days long; the prior
    window is the same length immediately before it. Eval runs are left out.
    Times are queued-to-finished over settled runs, as on the Agents Performance page.
    """

    agent_id: str
    days: int
    #: Midnight UTC of the window's first day.
    since: datetime
    runs: int
    runs_prior: int
    #: Runs Verify said served (``yes``).
    served: int
    #: Served over the runs Verify gave a verdict; null when none did.
    served_rate: float | None = None
    served_rate_prior: float | None = None
    p95_ms: float | None = None
    p95_prior_ms: float | None = None
    #: Since the first of this calendar month, beside the month budget.
    tokens_this_month: int
    max_tokens_month: int | None = None
    #: Agents this one spawned in the window.
    spawned: int
    daily: list[AgentOverviewDay] = Field(default_factory=list)
    exits: list[AgentOverviewExit] = Field(default_factory=list)
    #: The ten newest root runs, whatever the window.
    recent: list[AgentOverviewRun] = Field(default_factory=list)
    models: list[AgentOverviewModel] = Field(default_factory=list)


class AgentMeters(BaseModel):
    """What the agent is using now, each beside the limit that caps it (AG23).

    Usage and budgets are in tokens, never currency.
    """

    agent_id: str
    tokens_this_month: int = 0
    max_tokens_month: int | None = None
    max_tokens_run: int | None = None
    running: int = 0
    queued: int = 0
    max_concurrent_runs: int | None = None
    runs_this_month: int = 0
    #: Sessions bound to this agent, the Graph's — a count, not the sessions,
    #: which stay private to whoever opened them.
    sessions: int = 0
    #: Agents it has spawned this month, and how deep it sits itself.
    spawned_this_month: int = 0
    depth: int = 0
    max_children: int | None = None
    max_depth: int | None = None
    max_fanout: int | None = None
    #: ``max_tokens_run`` under its old name, answered for one release.
    max_tokens: int | None = None


class DefaultAgentRequest(BaseModel):
    agent_id: str
