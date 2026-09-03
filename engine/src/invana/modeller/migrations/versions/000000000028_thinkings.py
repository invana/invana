"""Thoughts · thinkings · thinking_steps · thought_stream (RFC-048 / RFC-055, S9b).

The record behind the sessions task trace: the ask (``thoughts``), each run
over it (``thinkings``), one row per task attempt (``thinking_steps``) and the
append-only emission log Studio tails (``thought_stream``). ``session_messages``
gains ``thinking_id`` on assistant rows so a settled reply finds its steps
without a stream. New tables + one nullable column, no backfill: replies written
before this migration simply have no trace.

Revision ID: 000000000028
Revises: 000000000027
Create Date: 2026-09-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000028"
down_revision: str | Sequence[str] | None = "000000000027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "thoughts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column(
            "session_id",
            sa.String(length=36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "message_id", sa.String(length=36), sa.ForeignKey("session_messages.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("author_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(length=2), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "thinkings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "thought_id",
            sa.String(length=36),
            sa.ForeignKey("thoughts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
        ),
        sa.Column("workflow_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column(
            "assistant_message_id",
            sa.String(length=36),
            sa.ForeignKey("session_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.JSON(), nullable=True),
        sa.Column("stream_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cursor", sa.JSON(), nullable=True),
    )
    op.create_table(
        "thinking_steps",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "thinking_id",
            sa.String(length=36),
            sa.ForeignKey("thinkings.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "message_id",
            sa.String(length=36),
            sa.ForeignKey("session_messages.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("task_key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("detail", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("input", sa.JSON(), nullable=True),
        sa.Column("output", sa.JSON(), nullable=True),
        sa.Column("error", sa.JSON(), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=True),
        sa.Column("tokens_out", sa.Integer(), nullable=True),
        sa.UniqueConstraint("thinking_id", "seq", "attempt", name="uq_thinking_step_attempt"),
    )
    op.create_table(
        "thought_stream",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "thinking_id",
            sa.String(length=36),
            sa.ForeignKey("thinkings.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=48), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("idem_key", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("thinking_id", "seq", name="uq_thought_stream_seq"),
    )
    with op.batch_alter_table("session_messages") as batch:
        batch.add_column(sa.Column("thinking_id", sa.String(length=36), nullable=True))
    op.create_index("ix_session_messages_thinking_id", "session_messages", ["thinking_id"])
    # A reply the user stopped (UC9). Postgres enums grow outside a transaction
    # (see migration 27); SQLite stores the enum as VARCHAR, nothing to do.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE session_message_status ADD VALUE IF NOT EXISTS 'stopped'")


def downgrade() -> None:
    op.drop_index("ix_session_messages_thinking_id", table_name="session_messages")
    with op.batch_alter_table("session_messages") as batch:
        batch.drop_column("thinking_id")
    op.drop_table("thought_stream")
    op.drop_table("thinking_steps")
    op.drop_table("thinkings")
    op.drop_table("thoughts")
