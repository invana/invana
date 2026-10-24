"""Wire shapes for the activity band: the change log (docs/for-developers/modules/operate/features/change-log.md),
search, and schedules, notifications and approvals.

One shape for every versioned record, so Studio draws one history and one
compare whatever the record is. ``version`` is a string because a model counts
in SemVer and everything else counts in integers.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from invana.activity.models import ApprovalStatus
from invana.apps.flows.schemas import PlanVersionDiff
from invana.apps.modeller.schemas import SchemaDiff
from invana.core.events.models import ActorKind
from invana.core.lists import Filter, ListSpec, Page
from invana.core.metrics import Change

RecordKind = Literal["skill", "rule", "plan", "agent", "model", "dataset"]


class ChangeEffect(BaseModel):
    """What ran on a version — counted, never estimated. Tokens, never currency."""

    #: ``pinned``: runs that recorded this version · ``window``: the Graph's runs
    #: while it was the published one · ``bound``: the loads that bound it.
    basis: Literal["pinned", "window", "bound"]
    runs: int
    failed: int
    tokens_in: int
    tokens_out: int
    tokens: int
    #: ``tokens / runs``, rounded; ``None`` when nothing ran.
    tokens_per_run: int | None
    #: The span it was the current version: from its publish to the next one's.
    since: datetime | None
    until: datetime | None


class ChangeEntry(BaseModel):
    """One version of a record, with the change that minted it."""

    version: str
    #: The version row's id; null for an agent, which keeps no version rows.
    version_id: str | None
    at: datetime | None
    #: The minting event; null when the version predates its event.
    action: str | None
    event_id: str | None
    actor_id: str | None
    actor_kind: ActorKind | None
    actor_name: str | None
    why: str | None
    #: One line against the version before it.
    summary: str
    effect: ChangeEffect


class RecordHistory(BaseModel):
    """Every version of one record, newest first."""

    record_kind: RecordKind
    record_id: str
    name: str
    items: list[ChangeEntry]


class ChangeField(BaseModel):
    """One field, before and after. ``lines`` is a unified diff for text fields."""

    field: str
    before: Any = None
    after: Any = None
    lines: list[str] = []


class RecordsSummary(BaseModel):
    """How two versions of a dataset differ, counted by record key."""

    added: int
    removed: int
    changed: int


class ChangeCompare(BaseModel):
    """Two versions of one record, from ``a`` to ``b``.

    ``a`` is null when ``b`` is the first version — compared against nothing,
    which is not the same as an empty diff.
    """

    record_kind: RecordKind
    record_id: str
    a: str | None
    b: str
    summary: str
    fields: list[ChangeField]
    #: The records added, removed and changed, for a dataset.
    records: RecordsSummary | None = None
    #: The plan diff, for a plan or for a skill whose two versions drew plans.
    plan: PlanVersionDiff | None = None
    #: The schema diff, for a model.
    schema_diff: SchemaDiff | None = None
    #: Tokens per run on ``b`` against ``a``; null when either ran nothing.
    tokens_per_run_change: Change | None = None


# ── Search (docs/for-developers/modules/platform/features/search.md) ─────────

SearchKind = Literal["graph", "model", "agent", "skill", "project", "world", "guardrail", "dataset"]


class SearchHit(BaseModel):
    """One record the reader may open, and where it lives."""

    kind: SearchKind
    id: str
    name: str
    #: ``<owner>/<slug>`` of the Graph it lives in; absent for a Graph or a dataset.
    graph: str | None = None
    #: The product that opens it; absent for a Graph.
    product: Literal["explorer", "modeller", "agents", "projects", "datasets"] | None = None
    match: Literal["exact", "prefix", "contains"]


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]


# ── Schedules · notifications · approvals ────────────────────────────────────
# docs/for-developers/modules/operate/features/schedules.md · notifications.md ·
# approvals.md. Members are named by id or username on the way in and by id on
# the way out.

MissedName = Literal["catch_up", "run_all", "skip"]
OverlapName = Literal["skip", "allow"]
ChannelKindName = Literal["email", "slack", "webhook"]


class ScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    agent: str = Field(description="The agent's key or id.")
    instructions: str = Field(min_length=1)
    cron: str
    timezone: str = "UTC"
    missed: MissedName = "catch_up"
    overlap: OverlapName = "skip"
    deliver_in_app: bool = True
    recipients: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list, description="Channel ids or names.")
    approve_outward: bool = True
    approvers: list[str] = Field(default_factory=list)
    approval_deadline_s: int = Field(default=86400, ge=60, le=30 * 86400)


class ScheduleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    agent: str | None = None
    instructions: str | None = Field(default=None, min_length=1)
    cron: str | None = None
    timezone: str | None = None
    missed: MissedName | None = None
    overlap: OverlapName | None = None
    deliver_in_app: bool | None = None
    recipients: list[str] | None = None
    channels: list[str] | None = None
    approve_outward: bool | None = None
    approvers: list[str] | None = None
    approval_deadline_s: int | None = Field(default=None, ge=60, le=30 * 86400)


class ScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    name: str
    agent_id: str | None
    instructions: str
    cron: str
    timezone: str
    status: str
    missed: str
    overlap: str
    deliver_in_app: bool
    recipient_ids: list[str]
    channel_ids: list[str]
    approve_outward: bool
    approver_ids: list[str]
    approval_deadline_s: int
    next_fire_at: datetime | None
    owner_id: str | None
    created_at: datetime
    updated_at: datetime


#: What the Schedules list takes. ``enabled=true`` is an active schedule,
#: ``false`` a paused one.
SCHEDULE_LIST = ListSpec(
    filters={
        "enabled": Filter(values=("true", "false"), labels={"true": "enabled", "false": "disabled"}),
        "agent_id": Filter(title="agent"),
    },
    sorts=("name",),
    search_title="name",
)


class SchedulePage(Page[ScheduleRead]):
    #: The Graph's paused schedules, counted over the whole Graph — not the filtered rows.
    paused: int = 0


class FiringRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    schedule_id: str
    due_at: datetime
    fired_at: datetime | None
    outcome: str
    catch_up: bool
    manual: bool
    run_id: str | None
    reason: str
    delivered_at: datetime | None


class FiringListResponse(BaseModel):
    items: list[FiringRead]
    total: int


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    kind: ChannelKindName
    #: email: the addresses; slack and webhook: the URL to post to.
    target: str = Field(min_length=1, max_length=2048)
    #: webhook only: the HMAC signing secret.
    secret: str | None = Field(default=None, max_length=512)


class ChannelRead(BaseModel):
    id: str
    name: str
    kind: str
    target: str
    ready: bool
    reason: str
    created_at: datetime


class ChannelListResponse(BaseModel):
    items: list[ChannelRead]
    total: int


class NotificationRuleWrite(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    events: list[str] = Field(min_length=1)
    match: dict[str, Any] = Field(default_factory=dict)
    members: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    requester: bool = False
    in_app: bool = True
    channels: list[str] = Field(default_factory=list)
    enabled: bool = True


class NotificationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    events: list[str] | None = Field(default=None, min_length=1)
    match: dict[str, Any] | None = None
    members: list[str] | None = None
    roles: list[str] | None = None
    requester: bool | None = None
    in_app: bool | None = None
    channels: list[str] | None = None
    enabled: bool | None = None


class NotificationRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    events: list[str]
    match: dict[str, Any]
    member_ids: list[str]
    roles: list[str]
    requester: bool
    in_app: bool
    channel_ids: list[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime


class NotificationRuleListResponse(BaseModel):
    items: list[NotificationRuleRead]
    total: int


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    title: str
    body: str
    event_id: str | None
    rule_id: str | None
    approval_id: str | None
    schedule_id: str | None
    run_id: str | None
    target_kind: str | None
    target_id: str | None
    read_at: datetime | None
    created_at: datetime


class InboxResponse(BaseModel):
    items: list[NotificationRead]
    unread: int
    #: Approvals waiting on the reader, which the inbox counts until decided.
    approvals_waiting: int


class MarkRead(BaseModel):
    #: The notifications to mark; omitted marks every unread one.
    ids: list[str] | None = None


class MarkReadResponse(BaseModel):
    marked: int


class ApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    subject_kind: str
    subject_id: str
    run_id: str | None
    schedule_id: str | None
    title: str
    payload: dict[str, Any]
    approver_ids: list[str]
    requested_by_id: str | None
    deadline_at: datetime
    reminded_at: datetime | None
    status: str
    decided_by_id: str | None
    decided_at: datetime | None
    note: str
    created_at: datetime


#: What waits for an approval — the ``subject_kind`` an approval is opened with.
APPROVAL_KINDS = ("step", "delivery", "model_publish", "agent", "skill")

#: What the Approvals list takes. ``q`` matches the title; ``mine=true`` narrows
#: to the approvals that name the reader as an approver.
APPROVAL_LIST = ListSpec(
    filters={
        "status": Filter(values=tuple(s.value for s in ApprovalStatus)),
        "kind": Filter(values=APPROVAL_KINDS, labels={"model_publish": "model publish"}),
        "mine": Filter(values=("true",), labels={"true": "mine"}, title="waiting on"),
    },
    sorts=("-created_at",),
    search_title="title",
)


class ApprovalDecide(BaseModel):
    note: str = Field(default="", max_length=2000)


# ── The fleet: the Agents Overview, Performance and who pins each model ────────
#
# Computed at read from the run rows, never kept (fleet-performance.md). Tokens,
# never currency; run time is queued → finished, in milliseconds.

FleetWindow = Literal[7, 30, 90]


class FleetMeasure(BaseModel):
    """One number over a window, the same number over the window before, and
    the change between them."""

    value: float | None
    prior: float | None
    #: Value against prior — in points for success, as a ratio otherwise; null with no prior.
    change: Change | None = None


class OverviewTiles(BaseModel):
    runs_today: int
    #: Roots queued on the same weekday a week ago.
    runs_week_ago: int
    #: Today against that day; null when nothing ran then.
    runs_change: Change | None = None
    failed_today: int
    #: The plan or agent of today's newest failed root.
    failed_latest: str | None
    #: Pending approvals plus roots paused on a question.
    waiting: int
    #: The title of the nearest-deadline approval, else the newest paused root's ask.
    waiting_latest: str | None
    #: The last 7 days against the 7 before.
    p95_ms: FleetMeasure
    tokens_this_month: int
    #: Σ the agents' ``max_tokens_month``; null when none declares one.
    max_tokens_month: int | None
    #: Succeeded over settled, the last 7 days against the 7 before.
    success: FleetMeasure


class AttentionItem(BaseModel):
    """One thing a builder should look at now, with what answers it."""

    kind: Literal["failing", "waiting", "degraded"]
    #: *nightly-load failed 3 runs running* · *Monthly deals brief waits on you* · *Analyst got 62% slower*.
    title: str
    #: The step, cause and message · what is waiting · the p95 and the change before it.
    detail: str
    run_id: str | None = None
    approval_id: str | None = None
    agent_id: str | None = None
    at: datetime | None = None


class DayCount(BaseModel):
    date: str
    succeeded: int
    failed: int


class RecentChange(BaseModel):
    """One agent or skill version and what ran on it after."""

    record_kind: Literal["agent", "skill"]
    record_id: str
    name: str
    version: str
    #: The version before it; null for a first version.
    previous: str | None
    at: datetime | None
    actor_name: str | None
    #: One line against the version before it.
    summary: str
    runs: int
    failed: int
    #: p95 on this version against p95 on the one before it; null with fewer
    #: than 3 runs on either side.
    p95_change: Change | None


class FleetOverview(BaseModel):
    agents: int
    skills: int
    tiles: OverviewTiles
    attention: list[AttentionItem]
    #: The last 30 days, oldest first, a row for every day.
    daily: list[DayCount]
    #: Newest first, at most 5.
    changes: list[RecentChange]


class Degradation(BaseModel):
    #: p95 of the slow runs.
    p95_ms: float
    baseline_p95_ms: float
    #: When the first slow run queued.
    since: datetime
    #: The newest version published before it, of the agent or a skill it binds.
    change: RecentChange | None


class PerformanceRow(BaseModel):
    """One agent, skill, plan or model over the window."""

    #: Agent id · skill id · plan ref · model version name.
    id: str
    name: str
    #: The skill's or plan's current version; null for an agent or a model.
    version: str | None
    runs: int
    success: float | None
    p50_ms: float | None
    p95_ms: float | None
    #: The window before — or, for a skill, its previous version over this window.
    p95_prior_ms: float | None
    #: p95 against ``p95_prior_ms``; null with no prior.
    p95_change: Change | None = None
    #: The version the prior was read off, for a skill read against its previous
    #: version; null when the prior is the window before.
    prior_version: str | None = None
    tokens_per_run: float | None
    tokens_per_run_prior: float | None
    #: Latest settled runs that failed, counted back to one that did not.
    failing: int
    signal: Literal["degraded", "failing"] | None
    degradation: Degradation | None


class FleetTiles(BaseModel):
    success: FleetMeasure
    p50_ms: FleetMeasure
    p95_ms: FleetMeasure
    runs: FleetMeasure
    tokens_per_run: FleetMeasure
    degraded: int
    failing: int


class TrendPoint(BaseModel):
    date: str
    #: Null on a day nothing settled.
    p95_ms: float | None


class TrendMark(BaseModel):
    date: str
    #: *skill v8* · *agent v3*.
    label: str


class PerformanceTrend(BaseModel):
    """p95 a day for one agent — the most degraded, else the busiest."""

    subject_kind: Literal["agent"]
    subject_id: str
    name: str
    baseline_p95_ms: float | None
    points: list[TrendPoint]
    marks: list[TrendMark]


class FleetPerformance(BaseModel):
    window_days: int
    tiles: FleetTiles
    agents: list[PerformanceRow]
    skills: list[PerformanceRow]
    plans: list[PerformanceRow]
    models: list[PerformanceRow]
    trend: PerformanceTrend | None


class PinnedAgent(BaseModel):
    id: str
    name: str


class PinnedSkill(BaseModel):
    id: str
    name: str
    #: The published version that pins it.
    version: int


class PinnedJudge(BaseModel):
    #: The eval set's subject: ``skill`` · ``agent``.
    subject_kind: str
    subject_id: str
    name: str


class ModelPin(BaseModel):
    #: ``llm/<provider name>/<model_id>``.
    address: str
    agents: list[PinnedAgent]
    skills: list[PinnedSkill]
    judges: list[PinnedJudge]


class ModelPins(BaseModel):
    items: list[ModelPin]
