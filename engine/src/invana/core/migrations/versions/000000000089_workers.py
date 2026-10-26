"""Workers: pools, joined workers, their events and stored numbers; join tokens.

docs/for-developers/modules/agents/features/workers.md.

A join token is a ``personal_access_tokens`` row narrowed to one pool, so that
table gains ``worker_pool_id`` · ``join_cap`` · ``joins``.

Revision ID: 000000000089
Revises: 000000000088
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000089"
down_revision: str | Sequence[str] | None = "000000000088"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _pool_fk() -> sa.ForeignKey:
    return sa.ForeignKey("worker_pools.id", ondelete="CASCADE")


def _user_fk() -> sa.ForeignKey:
    return sa.ForeignKey("users.id", ondelete="SET NULL")


def upgrade() -> None:
    op.create_table(
        "worker_pools",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("runs_on", sa.String(16), nullable=False, server_default="python"),
        sa.Column("labels", sa.JSON(), nullable=False),
        sa.Column("slots_per_worker", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("plugins", sa.JSON(), nullable=False),
        sa.Column("secrets", sa.JSON(), nullable=False),
        sa.Column("egress", sa.JSON(), nullable=False),
        sa.Column("set_by", sa.String(16), nullable=False, server_default="hand"),
        sa.Column("replicas", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.String(36), _user_fk(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "workers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pool_id", sa.String(36), _pool_fk(), nullable=False, index=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("node", sa.String(255), nullable=False, server_default=""),
        sa.Column("version", sa.String(32), nullable=False, server_default=""),
        sa.Column("labels", sa.JSON(), nullable=False),
        sa.Column("plugins", sa.JSON(), nullable=False),
        sa.Column("slots", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("state", sa.String(16), nullable=False, server_default="starting", index=True),
        sa.Column("slots_busy", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cpu", sa.Float(), nullable=True),
        sa.Column("credential_hash", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("previous_credential_hash", sa.String(64), nullable=True, index=True),
        sa.Column("credential_rotated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("queue_worker_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "joined_via",
            sa.String(36),
            sa.ForeignKey("personal_access_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("from_ip", sa.String(64), nullable=True),
        sa.Column("redelivered", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "worker_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pool_id", sa.String(36), _pool_fk(), nullable=False, index=True),
        sa.Column("worker_id", sa.String(36), sa.ForeignKey("workers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("change", sa.String(16), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("why", sa.Text(), nullable=False, server_default=""),
        sa.Column("actor_id", sa.String(36), _user_fk(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "worker_stats",
        sa.Column("pool_id", sa.String(36), _pool_fk(), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("workers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("starting", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lost", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("slots", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("slots_busy", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ready", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("oldest_s", sa.Integer(), nullable=True),
        sa.Column("envelopes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("suggested", sa.Integer(), nullable=False, server_default="0"),
    )
    with op.batch_alter_table("personal_access_tokens") as batch:
        batch.add_column(sa.Column("worker_pool_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("join_cap", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("joins", sa.Integer(), nullable=False, server_default="0"))
        batch.create_index("ix_personal_access_tokens_worker_pool_id", ["worker_pool_id"])


def downgrade() -> None:
    with op.batch_alter_table("personal_access_tokens") as batch:
        batch.drop_index("ix_personal_access_tokens_worker_pool_id")
        batch.drop_column("joins")
        batch.drop_column("join_cap")
        batch.drop_column("worker_pool_id")
    op.drop_table("worker_stats")
    op.drop_table("worker_events")
    op.drop_table("workers")
    op.drop_table("worker_pools")
