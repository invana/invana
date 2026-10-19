"""A clarifying question may describe its options.

docs/for-developers/modules/ask/features/clarifying-questions.md. One new
column, ``session_messages.clarification_descriptions``: one entry per option in
``clarification_options``, "" where the label says enough. Null on every
existing row, which reads as one-line options.

Revision ID: 000000000079
Revises: 000000000078
Create Date: 2026-10-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000079"
down_revision: str | Sequence[str] | None = "000000000078"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("session_messages") as batch:
        batch.add_column(sa.Column("clarification_descriptions", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("session_messages") as batch:
        batch.drop_column("clarification_descriptions")
