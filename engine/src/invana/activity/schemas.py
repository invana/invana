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

from invana.apps.modeller.schemas import SchemaDiff
from invana.apps.task_plans.schemas import PlanVersionDiff
from invana.core.events.models import ActorKind

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


class ScheduleListResponse(BaseModel):
    items: list[ScheduleRead]
    total: int


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


class ApprovalListResponse(BaseModel):
    items: list[ApprovalRead]
    total: int


class ApprovalDecide(BaseModel):
    note: str = Field(default="", max_length=2000)
