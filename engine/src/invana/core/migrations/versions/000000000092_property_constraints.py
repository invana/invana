"""Constraints on properties: a range with a unit, or a standard's values.

docs/for-developers/modules/connect-and-model/features/property-constraints.md.

A constraint is a ``validation_rules`` row. ``rule_type`` gains ``standard``;
the row gains the range's ``unit``, the pinned standard version and its
address, the term, and ``on_break`` (``reject`` · ``flag``). Every existing
rule rejects, as it did.

Revision ID: 000000000092
Revises: 000000000091
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000092"
down_revision: str | Sequence[str] | None = "000000000091"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE rule_type_enum ADD VALUE IF NOT EXISTS 'standard'")
    op.add_column("validation_rules", sa.Column("unit", sa.String(32), nullable=True))
    op.add_column(
        "validation_rules",
        sa.Column(
            "standard_version_id",
            sa.String(36),
            sa.ForeignKey("standard_versions.id", ondelete="SET NULL", name="fk_validation_rules_standard_version"),
            nullable=True,
        ),
    )
    op.add_column("validation_rules", sa.Column("standard_ref", sa.String(160), nullable=True))
    op.add_column("validation_rules", sa.Column("term", sa.String(255), nullable=True))
    op.add_column(
        "validation_rules",
        sa.Column("on_break", sa.String(8), nullable=False, server_default="reject"),
    )


def downgrade() -> None:
    op.drop_column("validation_rules", "on_break")
    op.drop_column("validation_rules", "term")
    op.drop_column("validation_rules", "standard_ref")
    op.drop_constraint("fk_validation_rules_standard_version", "validation_rules", type_="foreignkey")
    op.drop_column("validation_rules", "standard_version_id")
    op.drop_column("validation_rules", "unit")
