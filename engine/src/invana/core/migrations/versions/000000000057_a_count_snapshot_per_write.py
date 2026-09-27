"""A type's count, snapshotted by every act that writes data (the-model-page.md MP14).

``type_count_snapshots`` holds one row per type per act — introspection, the end
of an import run, a stitch commit — so the Growth tab draws a line that moves
only where something wrote, and each mark names the run that did (MP30).

No backfill. A Graph's line starts at its next introspection or import; drawing
a history that was never counted would be the chart of zeros the page refuses.

Revision ID: 000000000057
Revises: 000000000056
Create Date: 2026-09-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000057"
down_revision: str | Sequence[str] | None = "000000000056"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SOURCE = sa.Enum("introspect", "import", "stitch_commit", name="count_snapshot_source_enum")
_KIND = sa.Enum("node", "edge", name="count_snapshot_kind_enum")


def upgrade() -> None:
    op.create_table(
        "type_count_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", _SOURCE, nullable=False),
        sa.Column("source_id", sa.String(36), nullable=True),
        sa.Column("kind", _KIND, nullable=False),
        sa.Column("type_name", sa.String(255), nullable=False),
        sa.Column("count", sa.Integer, nullable=False),
        sa.Column("max_degree", sa.Integer, nullable=True),
        sa.Column("median_degree", sa.Integer, nullable=True),
    )
    op.create_index("ix_type_count_snapshots_graph_at", "type_count_snapshots", ["graph_id", "at"])


def downgrade() -> None:
    op.drop_index("ix_type_count_snapshots_graph_at", table_name="type_count_snapshots")
    op.drop_table("type_count_snapshots")
    _SOURCE.drop(op.get_bind(), checkfirst=True)
    _KIND.drop(op.get_bind(), checkfirst=True)
