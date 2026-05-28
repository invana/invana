"""Add import_jobs.logs (RFC-020 — structured per-run log lines).

Revision ID: 000000000011
Revises: 000000000010
Create Date: 2026-05-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000011"
down_revision: str | Sequence[str] | None = "000000000010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "import_jobs",
        sa.Column("logs", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("import_jobs", "logs")
