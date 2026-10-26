"""A run's stored times are 64-bit.

docs/for-developers/modules/platform/features/metrics-are-stored.md.

``task_runs.duration_ms`` · ``queue_ms`` · ``work_ms`` · ``ask_ms`` ·
``wait_ms`` become ``BIGINT``. As 32-bit integers they held at most 24.8 days,
so a run left open longer (an ask nobody answered) could not settle, and the
restart sweep that fails such runs stopped the engine starting.

Revision ID: 000000000087
Revises: 000000000086
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000087"
down_revision: str | Sequence[str] | None = "000000000086"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = ("duration_ms", "queue_ms", "work_ms", "ask_ms", "wait_ms")


def upgrade() -> None:
    with op.batch_alter_table("task_runs") as batch:
        for column in _COLUMNS:
            batch.alter_column(column, existing_type=sa.Integer(), type_=sa.BigInteger(), existing_nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("task_runs") as batch:
        for column in _COLUMNS:
            batch.alter_column(column, existing_type=sa.BigInteger(), type_=sa.Integer(), existing_nullable=True)
