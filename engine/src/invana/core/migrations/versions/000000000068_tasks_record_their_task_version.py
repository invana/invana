"""A Task records the version of the task type it uses.

``tasks.task_version`` is the task type's semver at the moment the plan's rows
were exploded, beside the ``step_key`` it already records — the same rule as a
pinned model version. Rows written before stay NULL: the version they ran
against was never recorded, and guessing it would be a claim nobody made.

Revision ID: 000000000068
Revises: 000000000067
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000068"
down_revision: str | Sequence[str] | None = "000000000067"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("task_version", sa.String(32), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_column("task_version")
