"""Emissions, projection templates, and how a run ended (S9b to S9d).

An answer becomes a **record**. Until now Studio folded an emission out of the
query result a reply carried and held it for the life of the page; `emissions`
is what makes an answer survive a reload
(docs/for-developers/modules/ask/features/the-answer-surface.md AS10).

Alongside it:

- ``projection_templates`` — the declared mapping from a shape to a surface, in
  both directions: how a question is put to a person, and how records are shown
  to one (projections.md P1).
- ``prompt_answers`` — what a person chose, stored as an option id and a value
  rather than as prose, so it replays and diffs (P3).
- ``thinkings.outcome`` — ``answered · cannot_answer · failed · cancelled``. A run
  that finished cleanly having found nothing is *succeeded* and *cannot_answer*;
  those are not the same claim (when-it-cannot-answer.md CA1).

Revision ID: 00000000002f
Revises: 00000000002e
Create Date: 2026-09-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000002f"
down_revision: str | Sequence[str] | None = "00000000002e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "emissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("thinking_id", sa.String(36), sa.ForeignKey("thinkings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", sa.String(36), nullable=True),
        sa.Column("step_id", sa.String(36), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("template_id", sa.String(36), nullable=True),
        sa.Column("citation", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("thinking_id", "seq", name="uq_emission_seq"),
    )
    op.create_index("ix_emissions_thinking_id", "emissions", ["thinking_id"])
    op.create_index("ix_emissions_message_id", "emissions", ["message_id"])

    op.create_table(
        "projection_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("surface", sa.String(24), nullable=False),
        sa.Column("accepts", sa.JSON(), nullable=False),
        sa.Column("spec", sa.JSON(), nullable=False),
        sa.Column("intent", sa.String(255), nullable=False, server_default=""),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(16), nullable=False, server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "name", "version", name="uq_projection_template_version"),
    )
    op.create_index("ix_projection_templates_graph_id", "projection_templates", ["graph_id"])

    op.create_table(
        "prompt_answers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("thinking_id", sa.String(36), sa.ForeignKey("thinkings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_seq", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.String(36), nullable=True),
        sa.Column("answered_by_kind", sa.String(16), nullable=False, server_default="user"),
        sa.Column("answered_by_id", sa.String(36), nullable=True),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prompt_answers_thinking_id", "prompt_answers", ["thinking_id"])

    with op.batch_alter_table("thinkings") as batch:
        batch.add_column(sa.Column("outcome", sa.String(16), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("thinkings") as batch:
        batch.drop_column("outcome")

    op.drop_index("ix_prompt_answers_thinking_id", table_name="prompt_answers")
    op.drop_table("prompt_answers")
    op.drop_index("ix_projection_templates_graph_id", table_name="projection_templates")
    op.drop_table("projection_templates")
    op.drop_index("ix_emissions_message_id", table_name="emissions")
    op.drop_index("ix_emissions_thinking_id", table_name="emissions")
    op.drop_table("emissions")
