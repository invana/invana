"""Schedules, notifications and approvals — what happens later, and who hears of it.

docs/for-developers/modules/operate/features/schedules.md · notifications.md ·
approvals.md. These rows live in the activity band because filling them reads
every other band: a firing opens a run, a rule reads the event record, an
approval holds a delivery. One loop works them all (``activity.clock``).

``schedules`` · ``schedule_firings``          an agent and instructions on a cron; each occurrence
``notification_rules`` · ``notification_channels``  who hears what, and where outside the inbox
``notifications``                             one row in one person's inbox
``notification_deliveries``                   one send to one channel, with what was sent
``notification_cursors``                      how far the clock has read ``events``
``approvals``                                 what waits to leave Invana until a named person decides
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class ScheduleStatus(enum.StrEnum):
    active = "active"
    paused = "paused"


class MissedPolicy(enum.StrEnum):
    """What a schedule does with occurrences the clock reached late."""

    catch_up = "catch_up"
    run_all = "run_all"
    skip = "skip"


class OverlapPolicy(enum.StrEnum):
    skip = "skip"
    allow = "allow"


class FiringOutcome(enum.StrEnum):
    queued = "queued"
    opened = "opened"
    skipped = "skipped"
    failed = "failed"


class ChannelKind(enum.StrEnum):
    email = "email"
    slack = "slack"
    webhook = "webhook"


class NotificationKind(enum.StrEnum):
    event = "event"
    delivery = "delivery"
    approval = "approval"
    reminder = "reminder"
    expired = "expired"


class DeliveryStatus(enum.StrEnum):
    held = "held"
    pending = "pending"
    sent = "sent"
    failed = "failed"
    declined = "declined"
    expired = "expired"


class ApprovalStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    declined = "declined"
    expired = "expired"


class Schedule(Base):
    """An agent and its instructions on a cron, and where the result goes."""

    __tablename__ = "schedules"
    __table_args__ = (
        UniqueConstraint("graph_id", "name", name="uq_schedule_name"),
        Index("ix_schedules_due", "status", "next_fire_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    #: Null once the agent is deleted; its firings then fail naming why.
    agent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"))
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    #: 5-field cron, read in ``timezone``.
    cron: Mapped[str] = mapped_column(String(128), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=ScheduleStatus.active.value, nullable=False)
    missed: Mapped[str] = mapped_column(String(16), default=MissedPolicy.catch_up.value, nullable=False)
    overlap: Mapped[str] = mapped_column(String(16), default=OverlapPolicy.skip.value, nullable=False)
    deliver_in_app: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: Members who get the inbox row besides the owner.
    recipient_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    channel_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: Whether a send to a channel waits for an approval.
    approve_outward: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: Who may approve; empty means the owner.
    approver_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    approval_deadline_s: Mapped[int] = mapped_column(Integer, default=86400, nullable=False)
    #: The next occurrence, UTC. Null while paused.
    next_fire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: On whose behalf every firing runs; never changed by an edit.
    owner_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ScheduleFiring(Base):
    """One occurrence of a schedule, recorded whether it ran or not."""

    __tablename__ = "schedule_firings"
    __table_args__ = (UniqueConstraint("schedule_id", "due_at", name="uq_schedule_firing_due"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    schedule_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    #: The latest of several missed occurrences, run once on recovery.
    catch_up: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    #: Fired by *run now*, not by the cron.
    manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    run_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("task_runs.id", ondelete="SET NULL"))
    reason: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    #: When the settled run was handed to the inbox and channels.
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class NotificationChannel(Base):
    """A place outside the inbox to send to. The credential is write-only."""

    __tablename__ = "notification_channels"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_notification_channel_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    #: What a reader sees: the addresses of an email channel, a masked URL otherwise.
    target: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    #: Fernet over ``{"url": …, "secret": …}``; null for email.
    secret_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class NotificationRule(Base):
    """Which events reach whom, on which channels."""

    __tablename__ = "notification_rules"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_notification_rule_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    #: Action names, or a prefix ending in ``.*``.
    events: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: Equality on the event's details, every key must hold.
    match: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    member_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    roles: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: The person the event was on behalf of.
    requester: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    in_app: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    channel_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class Notification(Base):
    """One row in one person's inbox."""

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", "rule_id", name="uq_notification_event_rule"),
        Index("ix_notifications_inbox", "graph_id", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    event_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    rule_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    approval_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    schedule_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    target_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class NotificationDelivery(Base):
    """One send to one channel: exactly what was sent, and how it went."""

    __tablename__ = "notification_deliveries"
    __table_args__ = (
        UniqueConstraint("channel_id", "event_id", "rule_id", name="uq_delivery_event_rule"),
        Index("ix_notification_deliveries_status", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    channel_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("notification_channels.id", ondelete="SET NULL"), index=True
    )
    rule_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    event_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    firing_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    approval_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    #: The message as the channel receives it.
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str] = mapped_column(Text, default="", nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class NotificationCursor(Base):
    """How far the clock has matched ``events`` against the rules."""

    __tablename__ = "notification_cursors"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    event_id: Mapped[str] = mapped_column(String(36), default="", nullable=False)


class Approval(Base):
    """Something waiting to leave Invana until a named approver decides."""

    __tablename__ = "approvals"
    __table_args__ = (Index("ix_approvals_pending", "status", "deadline_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: What it holds — ``delivery``: a firing's sends to channels.
    subject_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    schedule_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    #: Exactly what will be sent, per channel, frozen at request.
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    approver_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    requested_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=ApprovalStatus.pending.value, nullable=False)
    decided_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
