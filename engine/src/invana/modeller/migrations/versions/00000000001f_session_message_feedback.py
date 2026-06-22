"""Add feedback to session messages (RFC-038/039).

A 👍/👎 vote on an assistant reply — the capture signal for refining
understanding. "up" | "down"; null on every other reply (and existing rows).

Revision ID: 00000000001f
Revises: 00000000001e
Create Date: 2026-06-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000001f"
down_revision: str | Sequence[str] | None = "00000000001e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "session_messages",
        sa.Column("feedback", sa.String(length=4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_messages", "feedback")
