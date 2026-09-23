"""The wire shapes for Govern.

A lens reads back as **one object** — its rules grouped by layer, its cast, its
``as_of`` — because that is what an auditor is handed
([GV1](docs/for-developers/modules/govern/spec.md)). Nothing here composes a
world out of four requests.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.govern.models import LensKind


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


class LensPromote(BaseModel):
    """One field, and no re-authoring ([GV3])."""

    scope: str = Field(default="graph", max_length=64)


class LensUsageRead(BaseModel):
    runs: int = 0
    last_used_at: datetime | None = None
    actor_ids: list[str] = Field(default_factory=list)


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
    #: ``graph_members.can_edit_guardrails`` for whoever asked (GV22).
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


class TouchesRead(BaseModel):
    """One run's ledger, and the three numbers the dashboard leads with.

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
