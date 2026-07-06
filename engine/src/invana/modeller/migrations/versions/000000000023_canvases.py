"""Add explorer canvases table (RFC-043).

A ``Canvas`` is a saved, shared view over a graph — the painted snapshot,
viewport, filters, node positions and settings, plus a title and purpose. Each
is backed 1:1 by a session (``session_id`` unique + CASCADE) and denormalizes
``graph_id`` for shared graph-scoped listing. Hard delete, downward cascade only
(Graph → Session → Canvas, and Graph → Canvas directly).

Revision ID: 000000000023
Revises: 000000000022
Create Date: 2026-07-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000023"
down_revision: str | Sequence[str] | None = "000000000022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "canvases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("source_query", sa.Text(), nullable=True),
        sa.Column("view_state", sa.JSON(), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("positions", sa.JSON(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("pinned", sa.Boolean(), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("session_id", name="uq_canvases_session_id"),
    )
    op.create_index("ix_canvases_graph_id", "canvases", ["graph_id"])
    op.create_index("ix_canvases_created_by_id", "canvases", ["created_by_id"])


def downgrade() -> None:
    op.drop_index("ix_canvases_created_by_id", table_name="canvases")
    op.drop_index("ix_canvases_graph_id", table_name="canvases")
    op.drop_table("canvases")
