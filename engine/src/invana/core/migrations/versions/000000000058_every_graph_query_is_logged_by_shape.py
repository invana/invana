"""Every graph query someone asked, logged by shape (the-model-page.md MP12 · MP15).

``graph_query_log`` is Invana's own record of who asked what, how long it took
and what it touched — written after the query answers, never failing it
(MP36), and pruned past 90 days. The Usage and Performance tabs read it; it is
not read back from telemetry, which is optional and off in tests (MP15).

No backfill: there is nothing to backfill from.

Revision ID: 000000000058
Revises: 000000000057
Create Date: 2026-09-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000058"
down_revision: str | Sequence[str] | None = "000000000057"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CALLER = sa.Enum("agent", "plan", "explorer", "api", name="query_caller_kind_enum")
_FROM = sa.Enum("plan", "results", name="query_touched_from_enum")


def upgrade() -> None:
    op.create_table(
        "graph_query_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("shape_hash", sa.String(16), nullable=False),
        sa.Column("shape_text", sa.Text, nullable=False),
        sa.Column("language", sa.String(16), nullable=False),
        sa.Column("caller_kind", _CALLER, nullable=False),
        sa.Column("caller_id", sa.String(64), nullable=True),
        sa.Column("task_run_id", sa.String(36), nullable=True),
        sa.Column("duration_ms", sa.Float, nullable=False),
        sa.Column("rows", sa.Integer, nullable=False),
        sa.Column("ok", sa.Boolean, nullable=False),
        sa.Column("types_touched", sa.JSON, nullable=False),
        sa.Column("properties_touched", sa.JSON, nullable=True),
        sa.Column("touched_from", _FROM, nullable=False),
    )
    op.create_index("ix_graph_query_log_graph_at", "graph_query_log", ["graph_id", "at"])
    op.create_index("ix_graph_query_log_graph_shape", "graph_query_log", ["graph_id", "shape_hash"])


def downgrade() -> None:
    op.drop_index("ix_graph_query_log_graph_shape", table_name="graph_query_log")
    op.drop_index("ix_graph_query_log_graph_at", table_name="graph_query_log")
    op.drop_table("graph_query_log")
    _CALLER.drop(op.get_bind(), checkfirst=True)
    _FROM.drop(op.get_bind(), checkfirst=True)
