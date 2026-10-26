"""The wire shapes for Govern.

A lens reads back as **one object** — its rules grouped by layer, its cast, its
``as_of`` — because that is what an auditor is handed
([GV1](docs/for-developers/modules/govern/spec.md)). Nothing here composes a
world out of four requests.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.govern.models import GuardrailAccess, LensKind, RequestKind
from invana.core.lists import Filter, ListSpec, Page


class RuleIn(BaseModel):
    """One statement. ``allow`` is the only required field beside the match."""

    match: str = Field(min_length=1, max_length=512)
    allow: bool
    properties: dict[str, Any] = Field(default_factory=dict)
    select: dict[str, Any] = Field(default_factory=dict)
    egress: dict[str, Any] = Field(default_factory=dict)
    options: dict[str, Any] = Field(default_factory=dict)


class LensCreate(BaseModel):
    """A new lens. **Unnamed by default** — naming is a separate act, because
    naming is what shares it ([WO1])."""

    name: str | None = Field(default=None, max_length=255)
    kind: LensKind = LensKind.world
    scope: str | None = Field(default=None, max_length=64)
    rules: list[RuleIn] = Field(default_factory=list)
    cast: dict[str, str | None] = Field(default_factory=dict)
    closed_layers: list[str] = Field(default_factory=list)
    as_of: datetime | None = None
    #: The run this lens was made for, when it was made from one — a Retune
    #: that has not been named yet.
    created_in_run_id: str | None = Field(default=None, max_length=36)


class LensUpdate(BaseModel):
    """Every field optional. Setting ``name`` on an unnamed lens **publishes it**."""

    name: str | None = Field(default=None, max_length=255)
    rules: list[RuleIn] | None = None
    cast: dict[str, str | None] | None = None
    closed_layers: list[str] | None = None
    as_of: datetime | None = None


class AgentUsageRead(BaseModel):
    """One agent whose runs asked under a world — the world board's cast."""

    agent_id: str
    name: str | None
    runs: int
    last_at: datetime | None


class LensUsageRead(BaseModel):
    runs: int = 0
    last_used_at: datetime | None = None
    actor_ids: list[str] = Field(default_factory=list)
    #: How many people have run under it.
    people: int = 0
    #: Runs in the last 30 days.
    runs_30d: int = 0
    #: The agents whose runs asked under it, most runs first.
    by_agent: list[AgentUsageRead] = Field(default_factory=list)


class CastResolutionRead(BaseModel):
    role: str
    address: str | None
    allowed: bool
    rule_matched: str | None = None
    source: str
    refusal: str | None = None


class LensRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    kind: str
    key: str | None
    name: str | None
    display_name: str
    scope: str | None
    rules: list[dict[str, Any]]
    #: ``rules`` split by what they say.
    allow_rules: int = 0
    deny_rules: int = 0
    cast: dict[str, Any]
    closed_layers: list[str]
    as_of: datetime | None
    created_in_run_id: str | None
    version: int
    is_named: bool
    created_at: datetime
    updated_at: datetime
    #: Filled by the edge, which is the only band that may read runs.
    usage: LensUsageRead | None = None
    #: The four roles after *innermost wins, then it is checked* — filled on
    #: the detail read alone, because it is a composition against the
    #: guardrails and a list of twenty lenses would compose it twenty times
    #: for a column nobody reads in a list (R4).
    cast_resolved: list[CastResolutionRead] | None = None


class LensListResponse(BaseModel):
    """The drawer's one read — and the one fact that decides what it may offer.

    ``may_edit_guardrails`` rides on the list rather than on a permissions
    route of its own because the drawer already asks for this exactly once, and
    a second request would let the rules and the right to edit them arrive at
    different moments — which is the one moment a control could flicker into
    existence. The rules render for everyone either way
    ([GR5](docs/for-developers/modules/govern/features/guardrails.md)); this
    says whether the **authoring** controls are drawn at all.
    """

    items: list[LensRead]
    total: int
    #: Whether whoever asked holds the ``modeller`` Graph role.
    may_edit_guardrails: bool = False


class RefusalRead(BaseModel):
    code: str
    rule: str
    message: str
    recourse: str | None = None


class WarningRead(BaseModel):
    code: str
    rule: str
    message: str


class ValidationRead(BaseModel):
    """What a save would be refused for — returned before the write."""

    ok: bool
    refusals: list[RefusalRead] = Field(default_factory=list)
    warnings: list[WarningRead] = Field(default_factory=list)


class ValidateRequest(BaseModel):
    """Dry-run a draft. Same shape as a create, minus the naming."""

    rules: list[RuleIn] = Field(default_factory=list)
    cast: dict[str, str | None] = Field(default_factory=dict)
    closed_layers: list[str] = Field(default_factory=list)
    #: Validate against this agent's pinned guardrail too, where there is one.
    agent_id: str | None = None


class WorldImpactRead(BaseModel):
    lens_id: str
    name: str
    loses: list[str]
    cast_denied: list[str]
    changes: bool
    summary: str


class ImpactRead(BaseModel):
    """*Saving this would change 2 of 4 worlds*, and what each one loses."""

    headline: str
    worlds: list[WorldImpactRead]


class ImpactRequest(BaseModel):
    rules: list[RuleIn] = Field(default_factory=list)
    closed_layers: list[str] = Field(default_factory=list)
    scope: str = "graph"


class ParticipantRead(BaseModel):
    address: str
    layer: str
    sublayer: str
    name: str
    label: str
    axes: dict[str, Any] = Field(default_factory=dict)
    properties: list[str] = Field(default_factory=list)
    note: str = ""


class CatalogueRead(BaseModel):
    """What this Graph can address, and — with ``match`` — what a rule would bite."""

    items: list[ParticipantRead]
    total: int
    layers_present: list[str]
    #: Echoed back so the builder can tell *nothing matched* from *no filter*.
    match: str | None = None


class TouchRead(BaseModel):
    seq: int
    step_key: str | None
    address: str
    layer: str
    sublayer: str
    participant: str
    direction: str
    rule_matched: str | None
    why: str | None
    volume: dict[str, Any]
    applied: dict[str, Any]
    sent: dict[str, Any]
    query: dict[str, Any]
    cost_usd: float | None
    duration_ms: int | None


class ParticipantReading(BaseModel):
    """One participant of a run, classified and counted."""

    address: str
    layer: str
    #: ``refused`` · ``touched`` · ``miss`` · ``never_touched``.
    verdict: str
    #: Why it was refused or missed, when the ledger said.
    why: str | None
    calls: int
    rows: int
    tokens: int


class LayerTally(BaseModel):
    """One layer of a run's ledger, counted."""

    layer: str
    #: Participants drawn on the layer — allowed, or engaged without being.
    allowed: int
    touched: int
    refused: int
    #: Every ledger row on the layer, and the engaged (not skipped) ones.
    touches: int
    calls: int
    rows: int


class TouchTallies(BaseModel):
    allowed: int
    touched: int
    never_touched: int
    refused: int


class TouchesRead(BaseModel):
    """One run's ledger, and the three numbers the board leads with.

    ``allowed`` is what the frozen lens permits across the catalogue; ``touched``
    is what actually happened. The **difference between the two** is what a
    person reads when they retune — three allowed and never touched is *narrow?*,
    two refused is *widen, or accept cannot answer deliberately*.
    """

    run_id: str
    items: list[TouchRead]
    total: int
    counts: dict[str, int]
    allowed: list[str] = Field(default_factory=list)
    touched: list[str] = Field(default_factory=list)
    never_touched: list[str] = Field(default_factory=list)
    refused: list[str] = Field(default_factory=list)
    participants: list[ParticipantReading] = Field(default_factory=list)
    layers: list[LayerTally] = Field(default_factory=list)
    tallies: TouchTallies | None = None


class CompareSideRead(BaseModel):
    run_id: str
    lens_id: str | None
    lens_name: str | None
    touched: list[str]
    cost_usd: float | None


class AppliedDiffRead(BaseModel):
    """How two runs narrowed the same participant differently.

    ``differs`` names the fields of ``run_touches.applied`` that are not equal,
    and ``a`` / ``b`` carry only those fields — a reader is shown the difference,
    not two whole documents to find it in
    ([WO18](docs/for-developers/modules/govern/features/worlds.md)).
    """

    differs: list[str]
    a: dict[str, Any] = Field(default_factory=dict)
    b: dict[str, Any] = Field(default_factory=dict)


class CompareCounts(BaseModel):
    """The compare's tiles, counted once."""

    touched_a: int = 0
    touched_b: int = 0
    shared: int = 0
    #: Reached by one run and not the other, either way round.
    only_one: int = 0
    #: Shared, but narrowed differently.
    read_differently: int = 0


class CompareRead(BaseModel):
    """Two runs, side by side. **The diff is the deliverable**, not the answers.

    Nothing is simulated and no answer is synthesised from another
    ([WO4](docs/for-developers/modules/govern/features/worlds.md)) — which is
    also why comparing costs money and says so.
    """

    a: CompareSideRead
    b: CompareSideRead
    only_in_a: list[str]
    only_in_b: list[str]
    shared: list[str]
    #: Keyed by address, and only the shared addresses that differ — a
    #: participant both runs read the same way is in ``shared`` and says no more
    #: ([WO18](docs/for-developers/modules/govern/features/worlds.md)).
    differed: dict[str, AppliedDiffRead] = Field(default_factory=dict)
    counts: CompareCounts = Field(default_factory=CompareCounts)


# ── a Graph's guardrails — one property rule each ────────────────────────────


class Ref(BaseModel):
    """A record by id and the name it reads as."""

    id: str
    name: str | None = None


class GuardrailIn(BaseModel):
    """*When a run touches* ``target`` · *it may* ``access`` · *and the result* ``leaves``."""

    target: str = Field(min_length=3, max_length=255)
    access: GuardrailAccess
    leaves: bool


class GuardrailUpdate(BaseModel):
    """Every field optional; the target is the guardrail's identity and does not move."""

    access: GuardrailAccess | None = None
    leaves: bool | None = None
    allowed_in: list[str] | None = None


class GuardrailRead(BaseModel):
    id: str
    name: str
    key: str
    target: str
    access: str
    leaves: bool
    #: The worlds a request allowed it in — runs asked there do not carry it.
    allowed_in: list[Ref] = Field(default_factory=list)
    #: How many published types carry the guarded property.
    types: int = 0
    #: Refusals it filed in the last seven days.
    refused_7d: int = 0
    #: The rule as one sentence.
    sentence: str = ""
    created_at: datetime
    updated_at: datetime


class GuardrailPage(BaseModel):
    """The Guardrails list, and whether whoever asked may edit it — in one read."""

    items: list[GuardrailRead]
    total: int
    may_edit: bool = False


class AppliesToRead(BaseModel):
    model: str
    type: str
    property: str


class GuardrailRefusalRead(BaseModel):
    request_id: str
    #: Who asked — a person's name, or the agent's.
    who: str | None
    #: Where from — ``explorer`` · ``agent`` · ``schedule`` · ``api``.
    where: str
    at: datetime


class HistoryRead(BaseModel):
    action: str
    actor: str | None
    at: datetime
    details: dict[str, Any] = Field(default_factory=dict)


class GuardrailDetail(GuardrailRead):
    applies_to: list[AppliesToRead] = Field(default_factory=list)
    #: The latest twenty requests it filed.
    refusals: list[GuardrailRefusalRead] = Field(default_factory=list)
    refusals_total: int = 0
    history: list[HistoryRead] = Field(default_factory=list)


class GuardrailTargetRead(BaseModel):
    """One ``Type.property`` the picker offers, and the published model it comes from."""

    target: str
    model: str
    type: str
    property: str


class GuardrailImpactRead(BaseModel):
    """Who reads the target today and would not afterwards — counted before the write."""

    worlds: list[Ref] = Field(default_factory=list)
    schedules: list[Ref] = Field(default_factory=list)
    sentence: str


# ── the lens view — a world read on the model ────────────────────────────────


class LensViewModel(BaseModel):
    name: str
    version: str | None
    #: ``all`` · ``sliced`` · ``hidden``.
    seen: str


class GuardedPropertyRead(BaseModel):
    property: str
    guardrail_id: str
    guardrail: str
    access: str
    leaves: bool


class LensViewType(BaseModel):
    model: str
    type: str
    hidden: bool
    sliced: bool
    excluded: list[str] = Field(default_factory=list)
    guarded: list[GuardedPropertyRead] = Field(default_factory=list)


class LensViewWindow(BaseModel):
    """The world's slice as a person reads it — ``2026-01-01 → 2026-06-30`` · ``in EU, UK``."""

    time: str | None = None
    geo: str | None = None


class AnswersGoRead(BaseModel):
    address: str
    #: What may accompany a call to it; ``None`` is unbounded.
    may_send: list[str] | None = None


class UsedByRead(BaseModel):
    #: ``agent`` · ``person``.
    kind: str
    id: str
    name: str | None
    runs: int


class LensView(BaseModel):
    """What a world — or the guardrails alone — let a run see, resolved by the engine."""

    world: Ref | None = None
    models: list[LensViewModel] = Field(default_factory=list)
    types: list[LensViewType] = Field(default_factory=list)
    hidden_types: list[str] = Field(default_factory=list)
    #: How many properties a guardrail guards across the published types.
    guarded: int = 0
    window: LensViewWindow = Field(default_factory=LensViewWindow)
    thinks_with: dict[str, str | None] = Field(default_factory=dict)
    answers_go: list[AnswersGoRead] = Field(default_factory=list)
    used_by: list[UsedByRead] = Field(default_factory=list)


# ── requests ─────────────────────────────────────────────────────────────────


REQUEST_LIST = ListSpec(
    filters={
        "status": Filter(values=("open", "done")),
        "kind": Filter(values=tuple(k.value for k in RequestKind)),
    },
    sorts=("-last_asked_at", "-created_at"),
)


class RequestCreate(BaseModel):
    """An explicit *Ask for a change* — by the caller, from Explorer or the API."""

    title: str = Field(min_length=1, max_length=512)
    detail: str | None = Field(default=None, max_length=4000)
    source: Literal["explorer", "api"] = "explorer"


class RequestResolve(BaseModel):
    action: Literal["decline", "allow", "model"]
    world_id: str | None = Field(default=None, max_length=36)
    model_id: str | None = Field(default=None, max_length=36)
    note: str | None = Field(default=None, max_length=512)


class RequestRead(BaseModel):
    id: str
    kind: str
    title: str
    detail: str | None
    source: str
    asked_by_id: str | None
    #: The asker's name, when a person asked.
    asked_by: str | None = None
    agent_id: str | None
    #: The agent's name, when an agent asked.
    agent: str | None = None
    run_id: str | None
    session_id: str | None
    guardrail_id: str | None
    blocked_by: str | None
    asks: int
    last_asked_at: datetime
    status: str
    resolution: str | None
    resolution_note: str | None
    world: Ref | None = None
    model: Ref | None = None
    resolved_by: str | None = None
    resolved_at: datetime | None
    created_at: datetime


class RequestPage(Page[RequestRead]):
    #: Open requests in the Graph, whatever the filter — the rail badge's count.
    open: int = 0
    #: Whether the reader holds the modeller role and may resolve.
    may_resolve: bool = False
