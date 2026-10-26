"""A rule version says why — ``rule_versions.because``.

docs/for-developers/modules/skills/features/rules.md. One optional line, part
of the published wording, named to whoever the rule stops.

Revision ID: 000000000094
Revises: 000000000093
Create Date: 2026-10-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000094"
down_revision: str | Sequence[str] | None = "000000000093"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("rule_versions", sa.Column("because", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("rule_versions", "because")
