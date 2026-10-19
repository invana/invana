"""A reply keeps the query that draws its table on the canvas.

docs/for-developers/modules/ask/features/ask-in-natural-language.md. One new
column, ``session_messages.canvas_query``: the whole-node twin Translate writes
beside a scalar-column query. Empty on every existing row, so no existing reply
offers *Load to canvas* for a table.

Revision ID: 000000000078
Revises: 000000000077
Create Date: 2026-10-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000078"
down_revision: str | Sequence[str] | None = "000000000077"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("session_messages") as batch:
        batch.add_column(sa.Column("canvas_query", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("session_messages") as batch:
        batch.drop_column("canvas_query")
