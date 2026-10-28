"""How many edges each stitch holds in the graph.

docs/for-developers/modules/connect-and-model/features/stitch-models.md.

``model_links.edges`` is re-counted after every solve that writes — a commit
and every import's stitch step — and null before the first.

Revision ID: 000000000090
Revises: 000000000089
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000090"
down_revision: str | Sequence[str] | None = "000000000089"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("model_links", sa.Column("edges", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("model_links", "edges")
