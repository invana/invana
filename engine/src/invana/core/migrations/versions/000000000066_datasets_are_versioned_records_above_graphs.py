"""Datasets are versioned records above Graphs.

``datasets`` (install-wide, ``publisher/name``), ``dataset_versions``
(immutable, hashed), ``dataset_records`` (one keyed row of one version) and
``dataset_bindings`` (a version bound into a Graph's model). Additive only —
the earlier ``datasets`` table was dropped by 041, so the name is free.

Revision ID: 000000000066
Revises: 000000000065
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000066"
down_revision: str | Sequence[str] | None = "000000000065"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("publisher", sa.String(63), nullable=False),
        sa.Column("name", sa.String(63), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("key_column", sa.String(255), nullable=False),
        sa.Column("visibility", sa.String(16), nullable=False),
        sa.Column("sensitivity", sa.String(16), nullable=False),
        sa.Column("column_sensitivity", sa.JSON(), nullable=False),
        sa.Column("refresh_schedule", sa.String(128), nullable=True),
        sa.Column("refresh_source", sa.Text(), nullable=True),
        sa.Column("current_version_id", sa.String(36), nullable=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("publisher", "name", name="uq_dataset_address"),
    )
    op.create_index("ix_datasets_publisher", "datasets", ["publisher"])
    op.create_index("ix_datasets_origin", "datasets", ["origin"])
    op.create_index("ix_datasets_created_by_id", "datasets", ["created_by_id"])

    op.create_table(
        "dataset_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(80), nullable=False),
        sa.Column("licence", sa.String(255), nullable=False),
        sa.Column("author_chain", sa.JSON(), nullable=False),
        sa.Column("columns", sa.JSON(), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("derived_from", sa.JSON(), nullable=False),
        sa.Column("why", sa.String(500), nullable=True),
        sa.Column("published_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retracted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retracted_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("retraction_reason", sa.String(500), nullable=True),
        sa.UniqueConstraint("dataset_id", "version", name="uq_dataset_version_number"),
    )
    op.create_index("ix_dataset_versions_dataset_id", "dataset_versions", ["dataset_id"])
    op.create_index("ix_dataset_versions_content_hash", "dataset_versions", ["content_hash"])
    op.create_foreign_key(
        "fk_datasets_current_version",
        "datasets",
        "dataset_versions",
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "dataset_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "version_id", sa.String(36), sa.ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=True),
        sa.UniqueConstraint("version_id", "key", name="uq_dataset_record_key"),
    )
    op.create_index("ix_dataset_records_version_id", "dataset_records", ["version_id"])

    op.create_table(
        "dataset_bindings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_id", sa.String(36), sa.ForeignKey("graph_models.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "dataset_version_id",
            sa.String(36),
            sa.ForeignKey("dataset_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type_name", sa.String(255), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("task_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("bound_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("bound_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "model_id", "dataset_id", "type_name", name="uq_dataset_binding_target"),
    )
    op.create_index("ix_dataset_bindings_graph_id", "dataset_bindings", ["graph_id"])
    op.create_index("ix_dataset_bindings_model_id", "dataset_bindings", ["model_id"])
    op.create_index("ix_dataset_bindings_dataset_id", "dataset_bindings", ["dataset_id"])
    op.create_index("ix_dataset_bindings_dataset_version_id", "dataset_bindings", ["dataset_version_id"])


def downgrade() -> None:
    op.drop_table("dataset_bindings")
    op.drop_table("dataset_records")
    op.drop_constraint("fk_datasets_current_version", "datasets", type_="foreignkey")
    op.drop_table("dataset_versions")
    op.drop_table("datasets")
