"""Model publish reviews — a breaking publish from its preview to its migration run.

docs/for-developers/modules/connect-and-model/features/publish-review.md. One
additive table; nothing existing changes.

Revision ID: 000000000073
Revises: 000000000072
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000073"
down_revision: str | Sequence[str] | None = "000000000072"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(table: str, ondelete: str):
    return sa.ForeignKey(f"{table}.id", ondelete=ondelete)


def upgrade() -> None:
    op.create_table(
        "model_publish_reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), _fk("graphs", "CASCADE"), nullable=False),
        sa.Column("model_id", sa.String(36), _fk("graph_models", "CASCADE"), nullable=False),
        sa.Column("version_id", sa.String(36), _fk("graph_versions", "CASCADE"), nullable=False),
        sa.Column("base_version_id", sa.String(36), _fk("graph_versions", "SET NULL"), nullable=True),
        sa.Column("draft_hash", sa.String(64), nullable=False),
        sa.Column("classification", sa.String(16), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False),
        sa.Column("preview", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("why", sa.Text(), nullable=False),
        sa.Column("approver_ids", sa.JSON(), nullable=False),
        sa.Column("deadline_s", sa.Integer(), nullable=False),
        sa.Column("requested_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("approval_id", sa.String(36), nullable=True),
        sa.Column("preview_run_id", sa.String(36), _fk("task_runs", "SET NULL"), nullable=True),
        sa.Column("run_id", sa.String(36), _fk("task_runs", "SET NULL"), nullable=True),
        sa.Column("published_version", sa.String(32), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_model_publish_reviews_graph_id", "model_publish_reviews", ["graph_id"])
    op.create_index("ix_model_publish_reviews_model_id", "model_publish_reviews", ["model_id"])
    op.create_index("ix_model_publish_reviews_approval_id", "model_publish_reviews", ["approval_id"])
    op.create_index("ix_model_publish_reviews_status", "model_publish_reviews", ["status"])


def downgrade() -> None:
    op.drop_index("ix_model_publish_reviews_status", table_name="model_publish_reviews")
    op.drop_index("ix_model_publish_reviews_approval_id", table_name="model_publish_reviews")
    op.drop_index("ix_model_publish_reviews_model_id", table_name="model_publish_reviews")
    op.drop_index("ix_model_publish_reviews_graph_id", table_name="model_publish_reviews")
    op.drop_table("model_publish_reviews")
