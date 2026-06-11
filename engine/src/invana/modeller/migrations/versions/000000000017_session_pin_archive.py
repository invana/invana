"""Add pin/archive flags to query sessions (RFC-024).

Two per-user organization flags on ``sessions``: ``pinned`` (sort to the top of
the list) and ``archived`` (hidden from the default list, revealed on demand).
Both default to false so existing rows backfill cleanly.

Revision ID: 000000000017
Revises: 000000000016
Create Date: 2026-06-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000017"
down_revision: str | Sequence[str] | None = "000000000016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "sessions",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("sessions", "archived")
    op.drop_column("sessions", "pinned")
