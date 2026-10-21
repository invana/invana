"""Annotations — what people and the assistant say about the graph's records.

docs/for-developers/modules/explore/features/annotations.md. Two additive
tables; nothing existing changes.

Revision ID: 000000000082
Revises: 000000000081
Create Date: 2026-10-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000082"
down_revision: str | Sequence[str] | None = "000000000081"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(table: str, ondelete: str):
    return sa.ForeignKey(f"{table}.id", ondelete=ondelete)


def upgrade() -> None:
    op.create_table(
        "annotations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), _fk("graphs", "CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("records", sa.JSON(), nullable=False),
        sa.Column("prop", sa.String(255), nullable=True),
        sa.Column("value_then", sa.JSON(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("color", sa.String(16), nullable=False),
        sa.Column("author_kind", sa.String(16), nullable=False),
        sa.Column("created_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("session_id", sa.String(36), _fk("sessions", "SET NULL"), nullable=True),
        sa.Column("message_id", sa.String(36), _fk("session_messages", "SET NULL"), nullable=True),
        sa.Column("reach", sa.String(16), nullable=False),
        sa.Column("promoted_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_annotations_graph_created", "annotations", ["graph_id", "created_at"])
    op.create_index("ix_annotations_created_by_id", "annotations", ["created_by_id"])
    op.create_index("ix_annotations_session_id", "annotations", ["session_id"])
    op.create_table(
        "annotation_anchors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("annotation_id", sa.String(36), _fk("annotations", "CASCADE"), nullable=False),
        sa.Column("graph_id", sa.String(36), nullable=False),
        sa.Column("record_id", sa.String(255), nullable=False),
    )
    op.create_index("ix_annotation_anchors_annotation_id", "annotation_anchors", ["annotation_id"])
    op.create_index("ix_annotation_anchors_graph_record", "annotation_anchors", ["graph_id", "record_id"])


def downgrade() -> None:
    op.drop_index("ix_annotation_anchors_graph_record", table_name="annotation_anchors")
    op.drop_index("ix_annotation_anchors_annotation_id", table_name="annotation_anchors")
    op.drop_table("annotation_anchors")
    op.drop_index("ix_annotations_session_id", table_name="annotations")
    op.drop_index("ix_annotations_created_by_id", table_name="annotations")
    op.drop_index("ix_annotations_graph_created", table_name="annotations")
    op.drop_table("annotations")
