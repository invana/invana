"""A stitch carries a key on each side (docs/for-developers/modules/connect-and-model/features/stitch-models.md ST26).

``identity_property`` was one property name applied to both sides, so
``Company.ticker ≡ Stock.nse_symbol`` — two models authored apart, neither about
to rename a published version because the other exists — could not be declared at
all. It becomes ``source_property`` and ``target_property``, with
``identity_match`` still saying how the two compare.

The pair reads two ways. On an **anchor** it is *same entity*; on a
**relationship** it is *where the edge attaches*, which is what lets a foreign key
already sitting on the records (``Order.instrument_isin`` → ``Stock.isin``) become
an edge without a dataset to import (ST27).

Every existing row was declared under a single name that held on both sides, so it
backfills to ``source_property = target_property = identity_property`` — the same
rule, said twice, which is exactly what it meant.

Revision ID: 000000000033
Revises: 000000000032
Create Date: 2026-09-13
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000033"
down_revision: str | Sequence[str] | None = "000000000032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("model_links") as batch:
        batch.alter_column("identity_property", new_column_name="source_property", existing_type=sa.String(255))
        batch.add_column(sa.Column("target_property", sa.String(255), nullable=True))
    # The old rule was one name on both sides. Saying it twice keeps every
    # declared stitch resolving exactly as it did.
    op.execute(sa.text("UPDATE model_links SET target_property = source_property"))


def downgrade() -> None:
    # The target key is dropped, so a stitch whose two sides spell the fact
    # differently stops resolving on the way down. Nothing can be done about
    # that — the old column has no room for it.
    with op.batch_alter_table("model_links") as batch:
        batch.drop_column("target_property")
        batch.alter_column("source_property", new_column_name="identity_property", existing_type=sa.String(255))
