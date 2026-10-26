"""The datasets a model version's publish touched.

docs/for-developers/modules/connect-and-model/features/the-model-page.md.

``graph_versions.affected_datasets`` lists each dataset bound to a type the
publish changed and the rows its scan found failing; History's *effect after*
reads it back. Empty for every version published before.

Revision ID: 000000000091
Revises: 000000000090
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000091"
down_revision: str | Sequence[str] | None = "000000000090"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "graph_versions",
        sa.Column("affected_datasets", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("graph_versions", "affected_datasets")
