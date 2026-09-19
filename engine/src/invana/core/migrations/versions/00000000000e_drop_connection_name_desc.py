"""Drop graph_connections.name and graph_connections.description.

These fields were redundant with the parent Graph's name/description (the
connection is 1:1 with the Graph — humans identify it by which graph it
belongs to, not by a separate label).

Revision ID: 00000000000e
Revises: 00000000000d
Create Date: 2026-05-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000000e"
down_revision: str | Sequence[str] | None = "00000000000d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("graph_connections", "description")
    op.drop_column("graph_connections", "name")


def downgrade() -> None:
    # Re-add as nullable so existing rows survive the downgrade. The original
    # schema had name NOT NULL and description NOT NULL DEFAULT '' — callers
    # backfilling would need to set name explicitly.
    op.add_column(
        "graph_connections",
        sa.Column("name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "graph_connections",
        sa.Column("description", sa.Text(), nullable=True),
    )
