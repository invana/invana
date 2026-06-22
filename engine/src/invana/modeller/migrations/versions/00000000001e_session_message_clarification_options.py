"""Add clarification_options to session messages (RFC-038).

When an NL reply is a clarifying question, the model can offer short answer
options the user picks instead of retyping. Stored as JSON; null on every other
reply (and on existing rows).

Revision ID: 00000000001e
Revises: 00000000001d
Create Date: 2026-06-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000001e"
down_revision: str | Sequence[str] | None = "00000000001d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "session_messages",
        sa.Column("clarification_options", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_messages", "clarification_options")
