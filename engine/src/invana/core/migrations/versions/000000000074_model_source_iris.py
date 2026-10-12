"""Source IRIs on model types and property keys — what an ontology import came from.

docs/for-developers/modules/connect-and-model/features/ontology-import.md. Three
nullable columns; nothing existing changes.

Revision ID: 000000000074
Revises: 000000000073
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000074"
down_revision: str | Sequence[str] | None = "000000000073"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("property_key_definitions", "node_type_definitions", "edge_type_definitions")


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(table, sa.Column("source_iri", sa.String(2048), nullable=True))


def downgrade() -> None:
    for table in _TABLES:
        op.drop_column(table, "source_iri")
