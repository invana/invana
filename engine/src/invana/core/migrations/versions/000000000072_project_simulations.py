"""Project simulations — a branch's handle on a simulator run.

docs/for-developers/modules/work/features/simulation.md. One additive table;
nothing existing changes.

Revision ID: 000000000072
Revises: 000000000071
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000072"
down_revision: str | Sequence[str] | None = "000000000071"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(table: str, ondelete: str):
    return sa.ForeignKey(f"{table}.id", ondelete=ondelete)


def upgrade() -> None:
    op.create_table(
        "project_simulations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), _fk("projects", "CASCADE"), nullable=False),
        sa.Column("branch_id", sa.String(36), _fk("project_branches", "CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("simulator", sa.String(64), nullable=False),
        sa.Column("simulator_version", sa.String(32), nullable=False),
        sa.Column("plugin", sa.String(128), nullable=False),
        sa.Column("plugin_version", sa.String(32), nullable=False),
        sa.Column("spec", sa.JSON(), nullable=False),
        sa.Column("seed", sa.BigInteger(), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False),
        sa.Column("run_id", sa.String(36), _fk("task_runs", "SET NULL"), nullable=True),
        sa.Column("created_by_id", sa.String(36), _fk("users", "SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_project_simulation_number"),
    )
    op.create_index("ix_project_simulations_project_id", "project_simulations", ["project_id"])
    op.create_index("ix_project_simulations_branch_id", "project_simulations", ["branch_id"])
    op.create_index("ix_project_simulations_run_id", "project_simulations", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_project_simulations_run_id", table_name="project_simulations")
    op.drop_index("ix_project_simulations_branch_id", table_name="project_simulations")
    op.drop_index("ix_project_simulations_project_id", table_name="project_simulations")
    op.drop_table("project_simulations")
