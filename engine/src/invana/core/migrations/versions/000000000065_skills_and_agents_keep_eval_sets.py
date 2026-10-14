"""Skills and agents keep eval sets.

``eval_sets`` (one per skill or agent), ``eval_cases`` (fixed questions and
their rule checks), ``eval_results`` (one case on one side of one eval run —
the run itself is a ``task_runs`` row with ``role=evaluate``) and
``eval_budgets`` (a Graph's monthly eval tokens). Additive only.

Revision ID: 000000000065
Revises: 000000000064
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000065"
down_revision: str | Sequence[str] | None = "000000000064"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "eval_sets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_kind", sa.String(16), nullable=False),
        sa.Column("subject_id", sa.String(36), nullable=False),
        sa.Column("judge_model_pin", sa.String(255), nullable=True),
        sa.Column("rubric", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("subject_kind", "subject_id", name="uq_eval_set_subject"),
    )
    op.create_index("ix_eval_sets_graph_id", "eval_sets", ["graph_id"])

    op.create_table(
        "eval_cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("eval_set_id", sa.String(36), sa.ForeignKey("eval_sets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("checks", sa.JSON(), nullable=False),
        sa.Column("label", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("source_run_id", sa.String(36), nullable=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_eval_cases_eval_set_id", "eval_cases", ["eval_set_id"])

    op.create_table(
        "eval_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("eval_run_id", sa.String(36), sa.ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("eval_case_id", sa.String(36), sa.ForeignKey("eval_cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_run_id", sa.String(36), sa.ForeignKey("task_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("side", sa.String(8), nullable=False),
        sa.Column("hard", sa.JSON(), nullable=False),
        sa.Column("judged", sa.Float(), nullable=True),
        sa.Column("tokens", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("answer_digest", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("eval_run_id", "eval_case_id", "side", name="uq_eval_result_side"),
    )
    op.create_index("ix_eval_results_eval_run_id", "eval_results", ["eval_run_id"])
    op.create_index("ix_eval_results_eval_case_id", "eval_results", ["eval_case_id"])

    op.create_table(
        "eval_budgets",
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("monthly_tokens", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("eval_budgets")
    op.drop_index("ix_eval_results_eval_case_id", table_name="eval_results")
    op.drop_index("ix_eval_results_eval_run_id", table_name="eval_results")
    op.drop_table("eval_results")
    op.drop_index("ix_eval_cases_eval_set_id", table_name="eval_cases")
    op.drop_table("eval_cases")
    op.drop_index("ix_eval_sets_graph_id", table_name="eval_sets")
    op.drop_table("eval_sets")
