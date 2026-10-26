"""What this Graph's MCP server serves.

docs/for-developers/modules/platform/features/this-graphs-mcp-server.md.

``mcp_served`` holds one switch per agent or function a builder turned on or
off; a candidate with no row is not served.

Revision ID: 000000000088
Revises: 000000000087
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000088"
down_revision: str | Sequence[str] | None = "000000000087"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_served",
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("kind", sa.String(16), primary_key=True),
        sa.Column("ref", sa.String(64), primary_key=True),
        sa.Column("served", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("changed_by_id", sa.String(36), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("mcp_served")
