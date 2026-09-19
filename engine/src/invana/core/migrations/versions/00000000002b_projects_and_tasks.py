"""Projects, tasks and dependencies (S12b, docs/for-developers/modules/work/spec.md sections 5-6).

Four tables and no second execution path: a Task is *worked through as*
thoughts and thinkings, which is why there is no ``task_runs`` here. The two
task-to-task relations are deliberately separate — ``tasks.parent_id`` is
*part of*, ``task_dependencies`` is *after* — because conflating them is what
makes "what comes next" unanswerable.

Revision ID: 00000000002b
Revises: 00000000002a
Create Date: 2026-09-06
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "00000000002b"
down_revision: str | Sequence[str] | None = "00000000002a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "graph_id",
            sa.String(length=36),
            sa.ForeignKey("graphs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_by_kind", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "key", name="uq_project_graph_key"),
    )

    op.create_table(
        "project_assignments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("principal_kind", sa.String(length=16), nullable=False),
        sa.Column("principal_id", sa.String(length=36), nullable=False),
        sa.Column("assigned_by_kind", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("assigned_by_id", sa.String(length=36), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "principal_kind", "principal_id", name="uq_project_assignment"),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "graph_id",
            sa.String(length=36),
            sa.ForeignKey("graphs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "parent_id",
            sa.String(length=36),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("acceptance", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open", index=True),
        sa.Column("assignee_kind", sa.String(length=16), nullable=True),
        sa.Column("assignee_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("created_by_kind", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("blocked_reason", sa.String(length=255), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "task_dependencies",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "task_id",
            sa.String(length=36),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "depends_on_id",
            sa.String(length=36),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("kind", sa.String(length=24), nullable=False, server_default="finish_to_start"),
        sa.Column("binds", sa.JSON(), nullable=True),
        sa.Column("created_by_kind", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("task_id", "depends_on_id", name="uq_task_dependency"),
    )

    # A thought may now be posed *about a task*, outside any session.
    op.add_column("thoughts", sa.Column("work_item_id", sa.String(length=36), nullable=True))
    op.add_column("thoughts", sa.Column("author_kind", sa.String(length=16), nullable=False, server_default="user"))


def downgrade() -> None:
    op.drop_column("thoughts", "author_kind")
    op.drop_column("thoughts", "work_item_id")
    op.drop_table("task_dependencies")
    op.drop_table("tasks")
    op.drop_table("project_assignments")
    op.drop_table("projects")
