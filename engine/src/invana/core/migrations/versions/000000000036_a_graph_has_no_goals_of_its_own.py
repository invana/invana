"""A graph has no goals of its own (docs/for-developers/modules/work/features/objectives-and-criteria.md D1).

Objectives and success criteria belong to a **Project**: a Graph is a bounded
domain, and the two columns it carried were written by one form and read by
nothing — not the runtime, not a prompt, not a list. ``instructions`` stays,
because it is real: ``thinking/runtime.py`` hands it to the LLM as the graph's
standing guidance, and it is one of the two required setup sections.

Revision ID: 000000000036
Revises: 000000000035
Create Date: 2026-09-14
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000036"
down_revision: str | Sequence[str] | None = "000000000035"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("graphs", "objectives")
    op.drop_column("graphs", "success_criteria")


def downgrade() -> None:
    # The columns come back empty: nothing read them, so there is nothing to
    # restore beyond the shape.
    op.add_column("graphs", sa.Column("success_criteria", sa.Text(), nullable=True))
    op.add_column("graphs", sa.Column("objectives", sa.Text(), nullable=True))
