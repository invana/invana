"""A connection names its database (docs/for-developers/modules/connect-and-model/features/connect-a-database.md).

A Neo4j server holds many databases. Until now a Graph could say which *server*
it read, never which database on it — the connector quietly took its own default
(``neo4j``), and someone pointing Invana at a second database had no field to say
so and no line in the settings panel telling them which one they had got.

The name is a column rather than a key inside the encrypted ``auth`` blob (CD8):
it is not a secret, so it is returned by ``GET …/connection`` and shown beside the
URI — and the "blank means unchanged" rule that credentials live by must never
reach a field where blank honestly means "the connector's default".

Revision ID: 000000000035
Revises: 000000000034
Create Date: 2026-09-14
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000035"
down_revision: str | Sequence[str] | None = "000000000034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable with no backfill: every existing row was connecting on the
    # connector's default, and NULL is exactly how that is said.
    op.add_column("graph_connections", sa.Column("database", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("graph_connections", "database")
