"""A thread's budget per run is in tokens.

docs/for-developers/modules/agents/features/envelope-and-budget.md. One new
column, ``sessions.max_tokens_run``; nothing existing changes. A money cap
cannot become a token count — what a token costs depends on the subscription —
so the column starts empty and the agent's own ``max_tokens_run`` applies.
``sessions.max_cost_usd_run`` stays for one release and bounds nothing.

Revision ID: 000000000077
Revises: 000000000076
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000077"
down_revision: str | Sequence[str] | None = "000000000076"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.add_column(sa.Column("max_tokens_run", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.drop_column("max_tokens_run")
