"""Schedules, notifications and approvals — what happens later, and who hears of it.

docs/for-developers/modules/operate/features/schedules.md · notifications.md ·
approvals.md. Eight new tables; nothing existing changes.

Revision ID: 000000000071
Revises: 000000000070
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000071"
down_revision: str | Sequence[str] | None = "000000000070"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id() -> sa.Column:
    return sa.Column("id", sa.String(36), primary_key=True)


def _graph() -> sa.Column:
    return sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)


def _at(name: str, nullable: bool = True) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def _json(name: str) -> sa.Column:
    return sa.Column(name, sa.JSON(), nullable=False)


def upgrade() -> None:
    op.create_table(
        "schedules",
        _id(),
        _graph(),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("agent_id", sa.String(36), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("cron", sa.String(128), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("missed", sa.String(16), nullable=False),
        sa.Column("overlap", sa.String(16), nullable=False),
        sa.Column("deliver_in_app", sa.Boolean(), nullable=False),
        _json("recipient_ids"),
        _json("channel_ids"),
        sa.Column("approve_outward", sa.Boolean(), nullable=False),
        _json("approver_ids"),
        sa.Column("approval_deadline_s", sa.Integer(), nullable=False),
        _at("next_fire_at"),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        _at("created_at"),
        _at("updated_at"),
        sa.UniqueConstraint("graph_id", "name", name="uq_schedule_name"),
    )
    op.create_index("ix_schedules_graph_id", "schedules", ["graph_id"])
    op.create_index("ix_schedules_due", "schedules", ["status", "next_fire_at"])

    op.create_table(
        "schedule_firings",
        _id(),
        sa.Column("schedule_id", sa.String(36), sa.ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False),
        _graph(),
        _at("due_at", nullable=False),
        _at("fired_at"),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("catch_up", sa.Boolean(), nullable=False),
        sa.Column("manual", sa.Boolean(), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("task_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(255), nullable=False),
        _at("delivered_at"),
        sa.Column("actor_id", sa.String(36), nullable=True),
        sa.UniqueConstraint("schedule_id", "due_at", name="uq_schedule_firing_due"),
    )
    op.create_index("ix_schedule_firings_schedule_id", "schedule_firings", ["schedule_id"])
    op.create_index("ix_schedule_firings_graph_id", "schedule_firings", ["graph_id"])

    op.create_table(
        "notification_channels",
        _id(),
        _graph(),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("target", sa.String(512), nullable=False),
        sa.Column("secret_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("created_by_id", sa.String(36), nullable=True),
        _at("created_at"),
        sa.UniqueConstraint("graph_id", "name", name="uq_notification_channel_name"),
    )
    op.create_index("ix_notification_channels_graph_id", "notification_channels", ["graph_id"])

    op.create_table(
        "notification_rules",
        _id(),
        _graph(),
        sa.Column("name", sa.String(128), nullable=False),
        _json("events"),
        _json("match"),
        _json("member_ids"),
        _json("roles"),
        sa.Column("requester", sa.Boolean(), nullable=False),
        sa.Column("in_app", sa.Boolean(), nullable=False),
        _json("channel_ids"),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_by_id", sa.String(36), nullable=True),
        _at("created_at"),
        _at("updated_at"),
        sa.UniqueConstraint("graph_id", "name", name="uq_notification_rule_name"),
    )
    op.create_index("ix_notification_rules_graph_id", "notification_rules", ["graph_id"])

    op.create_table(
        "notifications",
        _id(),
        _graph(),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("event_id", sa.String(36), nullable=True),
        sa.Column("rule_id", sa.String(36), nullable=True),
        sa.Column("approval_id", sa.String(36), nullable=True),
        sa.Column("schedule_id", sa.String(36), nullable=True),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("target_kind", sa.String(32), nullable=True),
        sa.Column("target_id", sa.String(36), nullable=True),
        _at("read_at"),
        _at("created_at"),
        sa.UniqueConstraint("user_id", "event_id", "rule_id", name="uq_notification_event_rule"),
    )
    op.create_index("ix_notifications_inbox", "notifications", ["graph_id", "user_id", "created_at"])

    op.create_table(
        "notification_deliveries",
        _id(),
        _graph(),
        sa.Column(
            "channel_id",
            sa.String(36),
            sa.ForeignKey("notification_channels.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rule_id", sa.String(36), nullable=True),
        sa.Column("event_id", sa.String(36), nullable=True),
        sa.Column("firing_id", sa.String(36), nullable=True),
        sa.Column("approval_id", sa.String(36), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        _json("payload"),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=False),
        _at("sent_at"),
        _at("created_at"),
        sa.UniqueConstraint("channel_id", "event_id", "rule_id", name="uq_delivery_event_rule"),
    )
    op.create_index("ix_notification_deliveries_channel_id", "notification_deliveries", ["channel_id"])
    op.create_index("ix_notification_deliveries_firing_id", "notification_deliveries", ["firing_id"])
    op.create_index("ix_notification_deliveries_approval_id", "notification_deliveries", ["approval_id"])
    op.create_index("ix_notification_deliveries_status", "notification_deliveries", ["status", "created_at"])

    op.create_table(
        "notification_cursors",
        sa.Column("name", sa.String(32), primary_key=True),
        _at("created_at", nullable=False),
        sa.Column("event_id", sa.String(36), nullable=False),
    )

    op.create_table(
        "approvals",
        _id(),
        _graph(),
        sa.Column("subject_kind", sa.String(16), nullable=False),
        sa.Column("subject_id", sa.String(36), nullable=False),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("schedule_id", sa.String(36), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        _json("payload"),
        _json("approver_ids"),
        sa.Column("requested_by_id", sa.String(36), nullable=True),
        _at("deadline_at", nullable=False),
        _at("reminded_at"),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("decided_by_id", sa.String(36), nullable=True),
        _at("decided_at"),
        sa.Column("note", sa.Text(), nullable=False),
        _at("created_at"),
    )
    op.create_index("ix_approvals_graph_id", "approvals", ["graph_id"])
    op.create_index("ix_approvals_pending", "approvals", ["status", "deadline_at"])


def downgrade() -> None:
    op.drop_table("approvals")
    op.drop_table("notification_cursors")
    op.drop_table("notification_deliveries")
    op.drop_table("notifications")
    op.drop_table("notification_rules")
    op.drop_table("notification_channels")
    op.drop_table("schedule_firings")
    op.drop_table("schedules")
