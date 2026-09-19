"""A run records what it spent (docs/for-developers/modules/operate/features/see-what-ran.md SR40).

``task_runs`` counted tokens and never carried money. Tokens are a fact the
provider returns; dollars are tokens x a rate, and the rate belongs to the
vendor's model rather than to a Graph — so the column is **derived when the row
settles** and there is no price table to migrate.

``NULL`` is not ``0``. A model with no published rate leaves the column unset,
which is *the price is not known*, and the Cost tile is absent rather than
reading ``$0.00`` (observability.md OB4 · SR34).

Revision ID: 000000000042
Revises: 000000000041
Create Date: 2026-09-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000042"
down_revision: str | Sequence[str] | None = "000000000041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # No backfill: the tokens of a run that has already finished could be priced
    # at today's rate, and that would be a guess about what a past call cost.
    # An unpriced past run reads as unknown, which is what it is.
    op.add_column("task_runs", sa.Column("cost_usd", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("task_runs", "cost_usd")
