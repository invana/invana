"""Add timeout_s to session messages (RFC-030).

Records the LLM translation timeout (seconds) an NL ask was sent with, on the
assistant message, so the composer can restore the user's choice when a session
is reopened. Nullable — QL messages, reruns, and existing rows carry null.

Revision ID: 00000000001b
Revises: 00000000001a
Create Date: 2026-06-18
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000001b"
down_revision: str | Sequence[str] | None = "00000000001a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "session_messages",
        sa.Column("timeout_s", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_messages", "timeout_s")
