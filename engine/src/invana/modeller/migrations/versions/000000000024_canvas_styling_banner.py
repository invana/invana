"""Add canvas styling + banner (RFC-045).

Enriches the 1:1 canvas visual layer with per node/edge-type ``styling`` rules
and a base64 ``banner`` screenshot. Both additive — ``styling`` defaults to an
empty object, ``banner`` is nullable — so no backfill is needed.

Revision ID: 000000000024
Revises: 000000000023
Create Date: 2026-07-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000024"
down_revision: str | Sequence[str] | None = "000000000023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("canvases") as batch_op:
        batch_op.add_column(sa.Column("styling", sa.JSON(), nullable=False, server_default="{}"))
        batch_op.add_column(sa.Column("banner", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("canvases") as batch_op:
        batch_op.drop_column("banner")
        batch_op.drop_column("styling")
