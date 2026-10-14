"""Agents and skill versions pin a model version; every run records the one it called.

``agents.model_pin`` and ``skill_versions.model_pin`` are a model address,
``llm/<provider name>/<model id>`` — null lets the cast decide.
``task_runs.model_version`` is the provider's version name the run called, and
``task_runs.rerun_of_run_id`` links a re-run to the root it re-ran.

Revision ID: 000000000062
Revises: 000000000061
Create Date: 2026-10-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000062"
down_revision: str | Sequence[str] | None = "000000000061"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("agents") as batch:
        batch.add_column(sa.Column("model_pin", sa.String(255), nullable=True))
    with op.batch_alter_table("skill_versions") as batch:
        batch.add_column(sa.Column("model_pin", sa.String(255), nullable=True))
    with op.batch_alter_table("task_runs") as batch:
        batch.add_column(sa.Column("model_version", sa.String(255), nullable=True))
        batch.add_column(sa.Column("rerun_of_run_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_task_runs_rerun_of_run_id", "task_runs", ["rerun_of_run_id"], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    with op.batch_alter_table("task_runs") as batch:
        batch.drop_constraint("fk_task_runs_rerun_of_run_id", type_="foreignkey")
        batch.drop_column("rerun_of_run_id")
        batch.drop_column("model_version")
    with op.batch_alter_table("skill_versions") as batch:
        batch.drop_column("model_pin")
    with op.batch_alter_table("agents") as batch:
        batch.drop_column("model_pin")
