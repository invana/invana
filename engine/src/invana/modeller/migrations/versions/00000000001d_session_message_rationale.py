"""Add rationale to session messages (RFC-036).

Persists the model's one-line rationale for a generated ``source_query`` on the
assistant message, so it can be replayed (with the query) as conversation
context for follow-up NL asks ("only show 5" → refine the prior turn). Nullable
— QL turns, reruns, and existing rows carry null.

Revision ID: 00000000001d
Revises: 00000000001c
Create Date: 2026-06-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000001d"
down_revision: str | Sequence[str] | None = "00000000001c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "session_messages",
        sa.Column("rationale", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_messages", "rationale")
