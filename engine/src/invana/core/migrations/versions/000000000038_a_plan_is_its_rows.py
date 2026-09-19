"""A plan is its rows (docs/for-developers/building-engine/task-model-migration.md **M2**).

Three moves, and they have to happen together because they trade one name.

1. ``tasks`` → ``todos`` and ``task_dependencies`` → ``todo_dependencies``.
   A **Todo** is what a person writes down; a **Task** is one node of a plan,
   the thing the runtime dispatches. They were sharing a table name, and M2
   needs ``tasks`` for the second meaning. Only the name moves here: the
   columns, and ``TaskStatus``, are M4's.

2. ``workflows`` → ``task_plans``. ``spec``/``dag`` jsonb do **not** survive:
   the plan is data *as rows*, and YAML is the authoring format, never a second
   source of truth. ``source`` becomes ``origin`` — ``seeded`` reads
   ``builtin`` and ``candidate`` reads ``generated``, because a generated
   one-off is not a candidate for anything until somebody promotes it
   (``the-library.md`` LB5 · LB6).

3. A new ``tasks`` — the plan node. ``task_plan_id`` is ``NOT NULL``, and that
   constraint *is* the rule "nothing a person authors is ever a Task".

**The seeded plans are not migrated, they are re-seeded.** Their steps live in
``apps/agents/registry.py`` and ``ensure_seeded`` explodes them into rows on the
next read of the library, with ``depends_on`` materialised. A promoted plan's
rows are rebuilt from the run snapshot it was promoted from, which is the only
copy that was ever authoritative.

Revision ID: 000000000038
Revises: 000000000037
Create Date: 2026-09-16
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000038"
down_revision: str | Sequence[str] | None = "000000000037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


#: Every index the old ``tasks`` / ``task_dependencies`` tables carried, and the
#: name it takes once the table is ``todos``. `parent_id` is the one that would
#: actually collide; the rest are renamed so the schema reads consistently
#: rather than leaving `ix_tasks_*` indexes on a table called `todos`.
_INDEX_RENAMES = (
    ("ix_tasks_graph_id", "ix_todos_graph_id"),
    ("ix_tasks_project_id", "ix_todos_project_id"),
    ("ix_tasks_parent_id", "ix_todos_parent_id"),
    ("ix_tasks_status", "ix_todos_status"),
    ("ix_tasks_assignee_id", "ix_todos_assignee_id"),
    ("ix_task_dependencies_task_id", "ix_todo_dependencies_task_id"),
    ("ix_task_dependencies_depends_on_id", "ix_todo_dependencies_depends_on_id"),
)


def upgrade() -> None:
    # ── 1 · free the name ──────────────────────────────────────────────────
    op.rename_table("tasks", "todos")
    op.rename_table("task_dependencies", "todo_dependencies")
    # Postgres does not rename a table's indexes with it, and the new `tasks`
    # below wants `ix_tasks_parent_id` for itself — so every index the old
    # table carried is renamed too, or the create collides.
    for old, new in _INDEX_RENAMES:
        op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")
    op.execute("ALTER TABLE todo_dependencies RENAME CONSTRAINT uq_task_dependency TO uq_todo_dependency")

    # ── 2 · the plan ───────────────────────────────────────────────────────
    op.create_table(
        "task_plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        # Null unless reusable: a one-off plan is named by the Todo it was
        # drafted for, not by a key nobody will type.
        sa.Column("key", sa.String(64), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("kind", sa.String(16), nullable=False, server_default="ask"),
        sa.Column("origin", sa.String(16), nullable=False, server_default="builtin"),
        sa.Column("intent", sa.JSON(), nullable=False),
        sa.Column("todo_id", sa.String(36), sa.ForeignKey("todos.id", ondelete="CASCADE"), nullable=True),
        sa.Column("args_schema", sa.JSON(), nullable=False),
        sa.Column("source_skill_version_ids", sa.JSON(), nullable=False),
        sa.Column("reusable", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("promoted_from_run_id", sa.String(36), nullable=True),
        sa.Column("created_by_kind", sa.String(16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "key", "version", name="uq_task_plan_graph_key_version"),
    )
    op.create_index("ix_task_plans_graph_id", "task_plans", ["graph_id"])
    op.create_index("ix_task_plans_kind", "task_plans", ["kind"])
    op.create_index("ix_task_plans_origin", "task_plans", ["origin"])
    op.create_index("ix_task_plans_reusable", "task_plans", ["reusable"])
    op.create_index("ix_task_plans_todo_id", "task_plans", ["todo_id"])

    # Carry the library across. `spec` is dropped rather than copied: the rows
    # below are the plan now, and the seeded entries rebuild themselves from
    # the registry on the next read.
    op.execute(
        """
        INSERT INTO task_plans (
            id, graph_id, key, version, name, description, kind, origin, intent,
            args_schema, source_skill_version_ids, reusable, promoted_from_run_id,
            created_by_kind, created_by_id, created_at
        )
        SELECT
            w.id, w.graph_id, w.key, w.version, w.key, w.description, 'ask',
            CASE w.source
                WHEN 'seeded'    THEN 'builtin'
                WHEN 'promoted'  THEN 'promoted'
                WHEN 'candidate' THEN 'generated'
                ELSE 'authored'
            END,
            w.intents, '{}'::json, '[]'::json,
            -- A generated one-off is never listed in the library (LB6).
            (w.source <> 'candidate'),
            w.promoted_from_thinking_id, w.created_by_kind, w.created_by_id, w.created_at
        FROM workflows w
        """
    )

    # ── 3 · the plan node ──────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        # NOT NULL — the constraint is the rule.
        sa.Column("task_plan_id", sa.String(36), sa.ForeignKey("task_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True),
        sa.Column("ordinal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("form", sa.String(16), nullable=False, server_default="callable"),
        sa.Column("step_key", sa.String(64), nullable=True),
        sa.Column("title", sa.String(255), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("args", sa.JSON(), nullable=False),
        sa.Column("assignee_kind", sa.String(16), nullable=True),
        sa.Column("assignee_id", sa.String(36), nullable=True),
        # Materialised, never inferred at read time: an order derived on every
        # read is an order nobody reviewed.
        sa.Column("depends_on", sa.JSON(), nullable=False),
        sa.Column("when", sa.Text(), nullable=True),
        sa.Column("map_over", sa.Text(), nullable=True),
        sa.Column("loop", sa.JSON(), nullable=True),
        sa.Column("approval", sa.JSON(), nullable=True),
        sa.Column("timeout_s", sa.Integer(), nullable=True),
        sa.Column("retry", sa.JSON(), nullable=True),
        sa.Column("pool", sa.String(64), nullable=True),
        sa.Column("max_parallel", sa.Integer(), nullable=True),
        sa.Column("on_lane_failure", sa.String(24), nullable=True),
        sa.Column("source_span", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("task_plan_id", "parent_id", "key", name="uq_task_plan_sibling_key"),
    )
    op.create_index("ix_tasks_task_plan_id", "tasks", ["task_plan_id"])
    op.create_index("ix_tasks_parent_id", "tasks", ["parent_id"])
    op.create_index("ix_tasks_step_key", "tasks", ["step_key"])

    op.drop_table("workflows")


def downgrade() -> None:
    op.create_table(
        "workflows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("spec", sa.JSON(), nullable=False),
        sa.Column("intents", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(16), nullable=False, server_default="seeded"),
        sa.Column("promoted_from_thinking_id", sa.String(36), nullable=True),
        sa.Column("created_by_kind", sa.String(16), nullable=False, server_default="user"),
        sa.Column("created_by_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("graph_id", "key", "version", name="uq_workflow_graph_key_version"),
    )
    op.create_index("ix_workflows_graph_id", "workflows", ["graph_id"])
    # The spec is not reconstructed: it was dropped on the way up, and the rows
    # that replaced it are the only copy. A downgrade re-seeds from the registry.
    op.drop_table("tasks")
    op.drop_table("task_plans")
    op.execute("ALTER TABLE todo_dependencies RENAME CONSTRAINT uq_todo_dependency TO uq_task_dependency")
    for old, new in _INDEX_RENAMES:
        op.execute(f"ALTER INDEX IF EXISTS {new} RENAME TO {old}")
    op.rename_table("todo_dependencies", "task_dependencies")
    op.rename_table("todos", "tasks")
