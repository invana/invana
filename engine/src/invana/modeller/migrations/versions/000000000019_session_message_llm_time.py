"""Add llm_time_ms to session messages (RFC-030).

Records the wall-clock of the NL→query translation step on the assistant
message, so the studio can show LLM time next to query time and see which one
dominated a turn. Nullable — QL messages, reruns, and existing rows carry null
(no translation happened).

Revision ID: 000000000019
Revises: 000000000018
Create Date: 2026-06-15
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000019"
down_revision: str | Sequence[str] | None = "000000000018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "session_messages",
        sa.Column("llm_time_ms", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_messages", "llm_time_ms")
