"""Add denormalized last_status to query sessions (RFC-024).

Tracks the status of a session's latest assistant reply on the ``sessions`` row
so the list can mark a session failed/running without loading its messages.
Nullable — existing rows backfill as null (no reply / unknown), which the list
treats the same as a plain session. Reuses the existing ``session_message_status``
enum type.

Revision ID: 000000000018
Revises: 000000000017
Create Date: 2026-06-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "000000000018"
down_revision: str | Sequence[str] | None = "000000000017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STATUS_ENUM = "session_message_status"
_STATUS_VALUES = ("running", "ok", "error")


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column(
            "last_status",
            pg.ENUM(*_STATUS_VALUES, name=_STATUS_ENUM, create_type=False),
            nullable=True,
        ),
    )
    # Backfill from each session's latest reply (highest seq) so existing
    # sessions reflect their status immediately, not just newly-sent ones.
    # Seqs are contiguous per session; the max-seq row is the latest assistant
    # message (user rows carry a null status, filtered out by the join).
    op.execute(
        """
        UPDATE sessions s
        SET last_status = m.status
        FROM session_messages m
        WHERE m.session_id = s.id
          AND m.status IS NOT NULL
          AND m.seq = (
              SELECT max(m2.seq) FROM session_messages m2 WHERE m2.session_id = s.id
          )
        """
    )


def downgrade() -> None:
    op.drop_column("sessions", "last_status")
