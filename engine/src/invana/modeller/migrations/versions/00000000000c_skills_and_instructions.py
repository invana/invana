"""Add skills + instructions tables (MVP § 2.4 + § 2.5).

Both are graph-scoped (CASCADE from graphs), with a unique (graph_id, name).
Skills carry a markdown `content` + `when_to_use`; Instructions carry a
markdown `content` + integer `priority` (higher = stronger weight).

Revision ID: 00000000000c
Revises: 00000000000b
Create Date: 2026-05-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000000c"
down_revision: str | Sequence[str] | None = "00000000000b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "skills",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("when_to_use", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("graph_id", "name", name="uq_skill_graph_name"),
    )
    op.create_index("ix_skills_graph_id", "skills", ["graph_id"])

    op.create_table(
        "instructions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("graph_id", "name", name="uq_instruction_graph_name"),
    )
    op.create_index("ix_instructions_graph_id", "instructions", ["graph_id"])


def downgrade() -> None:
    op.drop_index("ix_instructions_graph_id", table_name="instructions")
    op.drop_table("instructions")
    op.drop_index("ix_skills_graph_id", table_name="skills")
    op.drop_table("skills")
