"""Backend version compatibility columns on graph_connections (RFC-022).

Adds detected/declared DB version + compatibility tracking so the modeller can gate
property types per backend+version and degrade untested/unknown versions to read-only.

Revision ID: 000000000014
Revises: 000000000013
Create Date: 2026-06-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000014"
down_revision: str | Sequence[str] | None = "000000000013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("graph_connections", sa.Column("server_version", sa.String(length=32), nullable=True))
    op.add_column("graph_connections", sa.Column("server_version_source", sa.String(length=16), nullable=True))
    op.add_column("graph_connections", sa.Column("compatibility_status", sa.String(length=16), nullable=True))
    op.add_column(
        "graph_connections",
        sa.Column("version_acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("graph_connections", "version_acknowledged")
    op.drop_column("graph_connections", "compatibility_status")
    op.drop_column("graph_connections", "server_version_source")
    op.drop_column("graph_connections", "server_version")
