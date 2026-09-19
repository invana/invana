"""A stitch names the model whose records ship it (docs/for-developers/building-engine/task-model-migration.md § 6.7).

``model_links.dataset_id`` said *which dataset supplies this edge's rows*. The
Dataset was never a container of its own — it bound to exactly one model — so the
column was the model, reached through a row that existed to hold a name and a
path. It becomes ``source_model_id``.

**The backfill reads ``datasets`` while it is still there.** That table is the
only mapping from a dataset id to the model it bound to, exactly as
``import_jobs`` was for the provenance stamp (§ 6.6), so this runs before the
drop and the drop is refused until it has.

Revision ID: 000000000040
Revises: 000000000039
Create Date: 2026-09-17
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000040"
down_revision: str | Sequence[str] | None = "000000000039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("model_links") as batch:
        batch.alter_column("dataset_id", new_column_name="source_model_id", existing_type=sa.String(36))
    # Through the Dataset row, while it still exists. A link whose dataset is
    # already gone keeps a value that resolves to no model, which is what it
    # already was — the row it pointed at had been deleted.
    op.execute(
        sa.text(
            "UPDATE model_links SET source_model_id = ("
            "  SELECT datasets.model_id FROM datasets WHERE datasets.id = model_links.source_model_id"
            ") WHERE source_model_id IS NOT NULL"
            "  AND EXISTS (SELECT 1 FROM datasets WHERE datasets.id = model_links.source_model_id)"
        )
    )


def downgrade() -> None:
    # Back through the same table, taking the most recently touched dataset of
    # that model. A model loaded from two folders had one of them here and the
    # column has no room to say which, so the newer one is the honest guess.
    op.execute(
        sa.text(
            "UPDATE model_links SET source_model_id = ("
            "  SELECT datasets.id FROM datasets"
            "  WHERE datasets.model_id = model_links.source_model_id"
            "  ORDER BY datasets.updated_at DESC LIMIT 1"
            ") WHERE source_model_id IS NOT NULL"
            "  AND EXISTS (SELECT 1 FROM datasets WHERE datasets.model_id = model_links.source_model_id)"
        )
    )
    with op.batch_alter_table("model_links") as batch:
        batch.alter_column("source_model_id", new_column_name="dataset_id", existing_type=sa.String(36))
