"""Add mode to session messages (RFC-024 / RFC-030).

Persists how an ask was started — "nl" (translated from natural language) or
"ql" (run as a raw query) — on the assistant message, so the composer restores
the original mode when a session is reopened instead of inferring it from the
``via`` label (which fails when the latest reply errored or was a rerun).
Nullable — existing rows carry null and fall back to the old via heuristic.

Revision ID: 00000000001c
Revises: 00000000001b
Create Date: 2026-06-18
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000001c"
down_revision: str | Sequence[str] | None = "00000000001b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "session_messages",
        sa.Column("mode", sa.String(length=2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_messages", "mode")
