"""Request and response shapes of IAM, under ``/api/v1/u/{username}/{graphSlug}/iam``.

docs/for-developers/modules/identity-and-access/features/policies.md ·
effective-access.md · people-and-groups.md · tokens.md · the-iam-product.md.
Every number here is the engine's; Studio prints it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from invana.core.lists import Filter, ListSpec, Page

POLICY_NAME_PATTERN = r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"

PolicyKindName = Literal["managed", "custom", "inline", "boundary"]
HolderKindName = Literal["person", "group", "agent", "token"]
Says = Literal["allows", "refuses", "n/a"]


# ── statements and limits ────────────────────────────────────────────────────


class StatementIn(BaseModel):
    """One statement as stored and sent — see ``core/policy.py``."""

    effect: Literal["allow"] = "allow"
    actions: list[str] = Field(min_length=1)
    resources: list[str] = Field(min_length=1)
    conditions: dict[str, Any] = Field(default_factory=dict)


class StatementRead(StatementIn):
    #: The layer the Statements table groups it under.
    layer: str


class LayerRead(BaseModel):
    """A layer row of the Statements table."""

    layer: str
    label: str
    line: str


class Limits(BaseModel):
    tokens_month: int | None = Field(default=None, ge=0)
    tokens_run: int | None = Field(default=None, ge=0)
    live_agents: int | None = Field(default=None, ge=0)
    descendants: int | None = Field(default=None, ge=0)
    depth: int | None = Field(default=None, ge=0)
    worker_seconds_hour: int | None = Field(default=None, ge=0)
    pools: list[str] = Field(default_factory=list)
    may_ask_more: bool = False


# ── policies ─────────────────────────────────────────────────────────────────


class HeldBy(BaseModel):
    """Who holds a policy, counted by the engine."""

    people: int = 0
    groups: int = 0
    agents: int = 0
    tokens: int = 0
    #: *group fare-team · 4 agents* · *12 people* · *the whole Graph*.
    line: str


class PolicyRow(BaseModel):
    id: str
    name: str
    kind: PolicyKindName
    status: Literal["draft", "saved"]
    #: *What it allows*.
    summary: str
    statement_count: int
    held_by: HeldBy
    changed_by: str | None = None
    changed_at: datetime | None = None


class PolicyRead(PolicyRow):
    description: str
    version: int
    owner: str | None = None
    drafted_by: Literal["person", "assistant"] = "person"
    statements: list[StatementRead]
    layers: list[LayerRead]
    limits: Limits
    #: The Graph area a managed policy may change (``build`` for builder); null otherwise.
    area: str | None = None
    #: Whether the caller may change it — false for a managed policy or without iam-admin.
    editable: bool


class PolicyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=POLICY_NAME_PATTERN)
    kind: Literal["custom", "boundary"] = "custom"
    description: str = ""
    statements: list[StatementIn] = Field(default_factory=list)
    limits: Limits = Field(default_factory=Limits)


class PolicyUpdate(BaseModel):
    description: str | None = None
    statements: list[StatementIn] | None = None
    limits: Limits | None = None
    why: str | None = Field(default=None, max_length=500)


class PolicySave(BaseModel):
    why: str | None = Field(default=None, max_length=500)


class PolicyDraftRequest(BaseModel):
    """*Draft with the assistant*: one sentence."""

    prompt: str = Field(min_length=3, max_length=2000)


class PolicyVersionRead(BaseModel):
    version: int
    saved_by: str | None = None
    saved_at: datetime
    why: str | None = None
    statement_count: int
    limit_count: int


POLICY_LIST = ListSpec(
    filters={
        "kind": Filter(values=("managed", "custom", "inline", "boundary")),
        "status": Filter(values=("draft", "saved")),
    },
    sorts=("name", "-updated_at"),
)


class PolicyPage(Page[PolicyRow]):
    #: Counts per kind over the unfiltered list, for the kind tabs.
    kinds: dict[str, int] = Field(default_factory=dict)


# ── impact ───────────────────────────────────────────────────────────────────


class ImpactRequest(BaseModel):
    statements: list[StatementIn]
    limits: Limits | None = None


class ImpactRow(BaseModel):
    holder_kind: Literal["person", "agent"]
    holder_id: str
    name: str
    change: Literal["gains", "loses", "same"]
    #: ``action on resource``, or *nothing new*.
    what: str
    #: Ledger rows for the lost pair over 30 days; null for a gain.
    used_30d: int | None = None
    used_line: str = ""


class ImpactBreak(BaseModel):
    agent_id: str
    agent: str
    skill_id: str
    skill: str
    version: int | None = None
    needs: str
    line: str


class ImpactRead(BaseModel):
    policy: str
    version: int
    holders_line: str
    rows: list[ImpactRow]
    breaks: list[ImpactBreak]


# ── holders ──────────────────────────────────────────────────────────────────


class HolderRow(BaseModel):
    #: The attachment id; null for a managed policy held as a member's role.
    id: str | None = None
    kind: HolderKindName
    holder_id: str
    name: str
    #: *sam · lee · 2 more* for a group, *built in Agents* for an agent.
    line: str
    #: *direct* · *via fare-team* · *direct · for run #2316* · *role*.
    how: str
    attached_by: str | None = None
    attached_at: datetime | None = None
    ends_at: datetime | None = None
    #: *when run #2316 ends* · *in 6 days* · null for always.
    ends_line: str | None = None


HOLDER_LIST = ListSpec(filters={"kind": Filter(values=("person", "group", "agent", "token"))}, sorts=("name",))


class HolderPage(Page[HolderRow]):
    kinds: dict[str, int] = Field(default_factory=dict)


class AttachRequest(BaseModel):
    holder_kind: Literal["person", "group", "agent"]
    holder_id: str
    ends: Literal["run", "days", "always"] = "always"
    days: int | None = Field(default=None, ge=1, le=365)
    run_id: str | None = None


# ── limits ───────────────────────────────────────────────────────────────────


class LimitRow(BaseModel):
    key: str
    label: str
    per: str
    ceiling: int | list[str] | None = None
    #: The engine's reading now — ``3.5M`` and ``57`` are both computed there.
    used: int | None = None
    used_line: str = "—"
    #: 0 to 100 for the meter; null when there is no ceiling or no reading.
    share: float | None = None


class LimitsRead(BaseModel):
    rows: list[LimitRow]
    may_ask_more: bool
    #: Who an ask for more goes to.
    asks_go_to: str | None = None


# ── test access ──────────────────────────────────────────────────────────────


class AccessCheckRequest(BaseModel):
    principal_kind: Literal["person", "agent", "token"]
    principal_id: str
    action: str = Field(min_length=1)
    #: ``graph/Fare/LHR-JFK · price`` — a field after `` · `` is optional.
    resource: str = Field(min_length=1)
    started_by: str | None = None
    world_id: str | None = None
    run_id: str | None = None


class PrincipalRef(BaseModel):
    kind: str
    id: str | None = None
    name: str


class AccessCheckLayer(BaseModel):
    layer: Literal["policies", "started_by", "world", "boundary", "token"]
    label: str
    by: list[PrincipalRef]
    says: Says
    reason: str = ""


class AccessCheckRead(BaseModel):
    allowed: bool
    decided_by: str | None = None
    message: str
    layers: list[AccessCheckLayer]


# ── agents and effective access ──────────────────────────────────────────────


class AgentAccessRow(BaseModel):
    agent_id: str
    name: str
    kind: str
    version: int
    policies: list[str]
    functions_allowed: int
    refused_7d: int
    #: *1 · send* — the count and the commonest refused function's kind.
    refused_line: str
    owner: str | None = None


AGENT_ACCESS_LIST = ListSpec(filters={"kind": Filter(values=("authored", "seeded"))}, sorts=("name",))


class AgentAccessPage(Page[AgentAccessRow]):
    kinds: dict[str, int] = Field(default_factory=dict)


class HeldPolicy(BaseModel):
    id: str
    name: str
    kind: PolicyKindName
    summary: str
    owner: str | None = None
    how: str


class EffectiveRow(BaseModel):
    action: str
    resource: str
    layer: str
    bound: str | None = None
    needs: bool
    policies: Says
    started_by: Says
    world: Says
    boundary: Says
    effective: Literal["allowed", "refused"]
    why: str = ""


class Delegate(BaseModel):
    agent_id: str
    name: str
    kind: str
    by_policy: str | None = None
    may: Literal["always", "ask", "never"]


class EffectiveRead(BaseModel):
    agent_id: str
    agent: str
    kind: str
    owner: str | None = None
    started_by: PrincipalRef | None = None
    world: PrincipalRef | None = None
    policies: list[HeldPolicy]
    layers: list[LayerRead]
    rows: list[EffectiveRow]
    delegates: list[Delegate]
    allowed: int
    refused: int


# ── people, groups, service accounts ─────────────────────────────────────────


class PersonRow(BaseModel):
    user_id: str
    username: str
    name: str
    email: str | None = None
    kind: Literal["person", "service"]
    groups: list[str]
    policies: list[str]
    tokens: int
    signs_in_with: str
    description: str | None = None


PEOPLE_LIST = ListSpec(filters={"kind": Filter(values=("person", "service"))}, sorts=("username",))


class PeoplePage(Page[PersonRow]):
    kinds: dict[str, int] = Field(default_factory=dict)


class ServiceAccountCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    description: str = Field(default="", max_length=500)


class GroupMemberRef(BaseModel):
    id: str
    member_kind: Literal["person", "agent"]
    member_id: str
    name: str


class GroupRow(BaseModel):
    id: str
    name: str
    description: str
    people: list[str]
    agents: list[str]
    policies: list[str]
    people_count: int
    agents_count: int


class GroupPolicyRef(BaseModel):
    """A policy a group holds, with the attachment that detaches it."""

    attachment_id: str
    name: str
    kind: PolicyKindName
    summary: str


class GroupRead(GroupRow):
    members: list[GroupMemberRef]
    held: list[GroupPolicyRef] = Field(default_factory=list)


GROUP_LIST = ListSpec(filters={}, sorts=("name",))


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=POLICY_NAME_PATTERN)
    description: str = ""


class GroupUpdate(BaseModel):
    description: str | None = None


class GroupMemberAdd(BaseModel):
    member_kind: Literal["person", "agent"]
    member_id: str


# ── tokens ───────────────────────────────────────────────────────────────────


class TokenHolder(BaseModel):
    user_id: str
    username: str
    kind: Literal["person", "service"]


class IamTokenRow(BaseModel):
    id: str
    name: str
    last_four: str
    holder: TokenHolder
    #: True for a token minted in this Graph's IAM; false for a profile token.
    graph_bound: bool
    #: *inline · graph.read.\** · *all of ravi's*.
    narrowed_to: str
    policy: str | None = None
    statements: list[StatementRead] = Field(default_factory=list)
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime
    #: Who minted it — the holder, or an iam-admin minting for a service account.
    created_by: str | None = None
    expired: bool


IAM_TOKEN_LIST = ListSpec(filters={}, sorts=("-created_at", "name"))


class IamTokenPage(Page[IamTokenRow]):
    #: The expiries *New token* offers, in days; never is always offered too.
    expiry_day_choices: list[int]
    #: How many live tokens one holder may hold.
    max_tokens: int


class IamTokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    #: A service account of this Graph; the caller when absent.
    holder_id: str | None = None
    statements: list[StatementIn] = Field(default_factory=list)
    #: One of the deployment's choices; null is never.
    expires_in_days: int | None = None


class IamTokenCreated(IamTokenRow):
    secret: str


# ── home ─────────────────────────────────────────────────────────────────────


class OverviewRead(BaseModel):
    people: int
    service_accounts: int
    groups: int
    agents: int
    policies: dict[str, int]
    tokens_live: int
    tokens_expiring_week: int
