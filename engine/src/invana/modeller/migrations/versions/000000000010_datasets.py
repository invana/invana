"""Add datasets + import_jobs tables (RFC-020).

A dataset (model.json + records) for a Graph, and the import-job runs that
derive/version a GraphModel, validate, ingest, and stitch. Cascade from Graph.

Revision ID: 000000000010
Revises: 00000000000f
Create Date: 2026-05-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000010"
down_revision: str | Sequence[str] | None = "00000000000f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("model_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("storage_uri", sa.String(length=2048), nullable=False),
        sa.Column("record_counts", sa.JSON(), nullable=False),
        sa.Column("last_job_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_id"], ["graph_models.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("graph_id", "name", name="uq_dataset_graph_name"),
    )
    op.create_index("ix_datasets_graph_id", "datasets", ["graph_id"])

    op.create_table(
        "import_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column(
            "status",
            sa.Enum("queued", "running", "succeeded", "failed", "cancelled", name="import_job_status_enum"),
            nullable=False,
        ),
        sa.Column("model_version_id", sa.String(length=36), nullable=True),
        sa.Column("records_total", sa.Integer(), nullable=False),
        sa.Column("records_processed", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("warning_count", sa.Integer(), nullable=False),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_version_id"], ["graph_versions.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_import_jobs_dataset_id", "import_jobs", ["dataset_id"])


def downgrade() -> None:
    op.drop_index("ix_import_jobs_dataset_id", table_name="import_jobs")
    op.drop_table("import_jobs")
    op.drop_index("ix_datasets_graph_id", table_name="datasets")
    op.drop_table("datasets")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.exec_driver_sql("DROP TYPE IF EXISTS import_job_status_enum;")
