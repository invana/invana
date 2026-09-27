"""A copied step names the step it came from (the-library.md LB36).

``tasks.source_plan_key`` says which library plan a skill's row was copied
from; ``tasks.source_step_key`` says which of that plan's steps. Between them a
skill's run of ``nl_single_translate_thought`` is ``nl-single@2``'s
``translate_thought`` because the copy recorded it, not because the key ends
that way — so the plan's page can count the skill's runs step by step.

No backfill. A skill whose copy predates this column names no source, so its
runs stay out of the plan's per-step table until the skill is saved again,
which copies afresh; stripping the prefix to fill it would be the guess the
column exists to avoid.

Revision ID: 000000000056
Revises: 000000000055
Create Date: 2026-09-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000056"
down_revision: str | Sequence[str] | None = "000000000055"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("source_step_key", sa.String(64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_column("source_step_key")
