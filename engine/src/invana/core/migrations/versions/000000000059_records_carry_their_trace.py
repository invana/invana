"""Records carry the trace they were written in.

A run row stores the trace it was started in and its own ``invana.run`` span,
so the run page can open the run in the collector's UI; an event row stores
the span it was emitted under, beside the trace id it already had. All three
columns are nullable: a record written with telemetry off, or outside any span,
has no ids to store.

No backfill: the ids of a trace that has already ended cannot be recovered.

Revision ID: 000000000059
Revises: 000000000058
Create Date: 2026-09-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000059"
down_revision: str | Sequence[str] | None = "000000000058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("task_runs", sa.Column("trace_id", sa.String(32), nullable=True))
    op.add_column("task_runs", sa.Column("root_span_id", sa.String(16), nullable=True))
    op.add_column("events", sa.Column("span_id", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "span_id")
    op.drop_column("task_runs", "root_span_id")
    op.drop_column("task_runs", "trace_id")
