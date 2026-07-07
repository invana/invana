"""Canvas version history (RFC-047).

Adds the append-only ``canvas_states`` table: one immutable snapshot per
canvas-mutating turn (query / expand / load), each carrying its own banner
thumbnail so the history is visual. Keep-all — nothing prunes these. New table
only, no changes to existing rows, so no backfill.

Revision ID: 000000000026
Revises: 000000000025
Create Date: 2026-07-07
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000026"
down_revision: str | Sequence[str] | None = "000000000025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "canvas_states",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "canvas_id",
            sa.String(length=36),
            sa.ForeignKey("canvases.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "graph_id",
            sa.String(length=36),
            sa.ForeignKey("graphs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "created_by_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "message_id",
            sa.String(length=36),
            sa.ForeignKey("session_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False, server_default=""),
        # gzipped canvas.exportState() envelope (RFC-047 storage optimisation) -
        # compresses ~5-10x and accrues one row per turn.
        sa.Column("snapshot_gz", sa.LargeBinary(), nullable=False),
        sa.Column("source_query", sa.Text(), nullable=True),
        sa.Column("styling", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("settings", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("banner", sa.Text(), nullable=True),
        sa.Column("node_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("edge_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("canvas_states")
