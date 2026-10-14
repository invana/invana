"""Tool plugins — which ones an Admin enabled, and what a worker made of each envelope.

docs/for-developers/modules/platform/features/tool-plugins.md. Two new tables;
nothing existing changes. procrastinate's own tables are applied by
``invana migrate`` through its schema manager, not here.

Revision ID: 000000000075
Revises: 000000000074
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000075"
down_revision: str | Sequence[str] | None = "000000000074"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plugin_states",
        sa.Column("name", sa.String(128), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("changed_by_id", sa.String(36), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "envelope_outcomes",
        sa.Column("idempotency_key", sa.String(160), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("outcome", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_envelope_outcomes_run_id", "envelope_outcomes", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_envelope_outcomes_run_id", table_name="envelope_outcomes")
    op.drop_table("envelope_outcomes")
    op.drop_table("plugin_states")
