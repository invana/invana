"""An import run is a thinking (S6, docs/for-developers/modules/bring-data-in/spec.md BD7).

Two small widenings and one link:

- ``thoughts.kind`` grows from two characters to sixteen. It held ``nl`` and
  ``ql``; it now also holds ``import`` — and, when stitching runs as its own kind,
  ``stitch``.
- ``import_jobs.thinking_id`` points a run at the thinking that ran it, so the
  trace is the same step card an answer uses and Studio grows no second run UI.
- ``datasets.created_by_id`` records who registered the dataset.

Revision ID: 00000000002e
Revises: 00000000002d
Create Date: 2026-09-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000002e"
down_revision: str | Sequence[str] | None = "00000000002d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("thoughts") as batch:
        batch.alter_column("kind", existing_type=sa.String(2), type_=sa.String(16), existing_nullable=False)

    with op.batch_alter_table("import_jobs") as batch:
        batch.add_column(sa.Column("thinking_id", sa.String(36), nullable=True))

    with op.batch_alter_table("datasets") as batch:
        batch.add_column(sa.Column("created_by_id", sa.String(36), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("datasets") as batch:
        batch.drop_column("created_by_id")

    with op.batch_alter_table("import_jobs") as batch:
        batch.drop_column("thinking_id")

    with op.batch_alter_table("thoughts") as batch:
        batch.alter_column("kind", existing_type=sa.String(16), type_=sa.String(2), existing_nullable=False)
