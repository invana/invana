"""Standards, a dataset's claims and conformance; rules at install scope with checks.

``standards`` (install-wide, ``publisher/name``) and ``standard_versions``
(immutable, hashed terms); ``dataset_standards`` (a dataset's claim on one
pinned standard version, with a mapping and a mode) and ``dataset_conformance``
(one dataset version scored against one standard version). ``rules.graph_id``
becomes nullable — no Graph is an install rule — and ``rule_versions`` gains
``check`` and ``mode``. Additive: every existing rule keeps its Graph.

Revision ID: 000000000067
Revises: 000000000066
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000067"
down_revision: str | Sequence[str] | None = "000000000066"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "standards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("publisher", sa.String(63), nullable=False),
        sa.Column("name", sa.String(63), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("current_version_id", sa.String(36), nullable=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("publisher", "name", name="uq_standard_address"),
    )
    op.create_index("ix_standards_publisher", "standards", ["publisher"])
    op.create_index("ix_standards_origin", "standards", ["origin"])
    op.create_index("ix_standards_created_by_id", "standards", ["created_by_id"])

    op.create_table(
        "standard_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("standard_id", sa.String(36), sa.ForeignKey("standards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("terms", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(80), nullable=False),
        sa.Column("why", sa.String(500), nullable=True),
        sa.Column("published_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("standard_id", "version", name="uq_standard_version_number"),
    )
    op.create_index("ix_standard_versions_standard_id", "standard_versions", ["standard_id"])
    op.create_index("ix_standard_versions_content_hash", "standard_versions", ["content_hash"])
    op.create_foreign_key(
        "fk_standards_current_version",
        "standards",
        "standard_versions",
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "dataset_standards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("standard_id", sa.String(36), sa.ForeignKey("standards.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "standard_version_id",
            sa.String(36),
            sa.ForeignKey("standard_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mode", sa.String(8), nullable=False),
        sa.Column("mapping", sa.JSON(), nullable=False),
        sa.Column("attached_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("attached_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("dataset_id", "standard_id", name="uq_dataset_standard"),
    )
    op.create_index("ix_dataset_standards_dataset_id", "dataset_standards", ["dataset_id"])
    op.create_index("ix_dataset_standards_standard_id", "dataset_standards", ["standard_id"])

    op.create_table(
        "dataset_conformance",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "dataset_version_id",
            sa.String(36),
            sa.ForeignKey("dataset_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "standard_version_id",
            sa.String(36),
            sa.ForeignKey("standard_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mapping", sa.JSON(), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("conforming", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("violation_count", sa.Integer(), nullable=False),
        sa.Column("violations", sa.JSON(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("dataset_version_id", "standard_version_id", name="uq_dataset_conformance_pair"),
    )
    op.create_index("ix_dataset_conformance_dataset_version_id", "dataset_conformance", ["dataset_version_id"])
    op.create_index("ix_dataset_conformance_standard_version_id", "dataset_conformance", ["standard_version_id"])

    with op.batch_alter_table("rules") as batch:
        batch.alter_column("graph_id", existing_type=sa.String(36), nullable=True)
    with op.batch_alter_table("rule_versions") as batch:
        batch.add_column(sa.Column("check", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("mode", sa.String(8), nullable=True))


def downgrade() -> None:
    op.execute("DELETE FROM rules WHERE graph_id IS NULL")
    with op.batch_alter_table("rule_versions") as batch:
        batch.drop_column("mode")
        batch.drop_column("check")
    with op.batch_alter_table("rules") as batch:
        batch.alter_column("graph_id", existing_type=sa.String(36), nullable=False)
    op.drop_table("dataset_conformance")
    op.drop_table("dataset_standards")
    op.drop_constraint("fk_standards_current_version", "standards", type_="foreignkey")
    op.drop_table("standard_versions")
    op.drop_table("standards")
