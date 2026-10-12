"""MCP plugins — the servers an Admin added, each with its tool list frozen.

docs/for-developers/modules/platform/features/mcp-plugins.md. One new table;
nothing existing changes. Whether a server's plugin is enabled stays in
``plugin_states``.

Revision ID: 000000000076
Revises: 000000000075
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000076"
down_revision: str | Sequence[str] | None = "000000000075"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_servers",
        sa.Column("name", sa.String(32), primary_key=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("tools", sa.JSON(), nullable=False),
        sa.Column("skipped", sa.JSON(), nullable=False),
        sa.Column("server", sa.JSON(), nullable=False),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("added_by_id", sa.String(36), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("mcp_servers")
