"""A skill draws as a plan (docs/for-developers/building-engine/skills-draw-as-plans.md **M8**).

Three changes, one idea: **a skill version owns a plan**.

``skill_versions.plan_id`` is ``NOT NULL`` and ``UNIQUE``
([SK13](docs/for-developers/modules/skills/features/authoring-a-skill.md)), so no
surface branches on *does this skill have a flow* and no two versions share a
drawing that one of them could edit.

``published_at`` becomes **nullable**, and null is the draft
([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)) — the
one mutable version row there will ever be. Every row that exists today was
published, so the backfill for that half is a no-op.

``skill_version_clarifications`` records what the planner asked about one
sentence and what the author answered, so a redraw never re-asks
([SK11](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

**The backfill is the interesting part.** ``NOT NULL`` over existing rows means
every skill version in every Graph needs a plan *before* the constraint lands,
and there is no prose-reader in a migration. Each one gets the same honest
fallback the product uses live: a plan with a single ``form: human`` node
carrying the skill's name
([SK15 · SK22](docs/for-developers/modules/skills/features/authoring-a-skill.md)) —
*a person does this step*. Nothing here guesses at a flow it cannot read.

Revision ID: 000000000048
Revises: 000000000047
Create Date: 2026-09-20
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000048"
down_revision: str | Sequence[str] | None = "000000000047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1 · the product's own playbooks are marked as such ───────────────────
    op.add_column(
        "skills",
        sa.Column("origin", sa.String(16), nullable=False, server_default="authored"),
    )

    # ── 2 · a draft is a version with no published_at ────────────────────────
    op.alter_column("skill_versions", "published_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.add_column("skill_versions", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE skill_versions SET created_at = published_at")
    op.alter_column("skill_versions", "created_at", existing_type=sa.DateTime(timezone=True), nullable=False)

    # ── 3 · every existing version gets its plan ─────────────────────────────
    op.add_column("skill_versions", sa.Column("plan_id", sa.String(36), nullable=True))
    op.execute(
        """
        CREATE TEMPORARY TABLE _m48 AS
        SELECT v.id AS version_id, gen_random_uuid()::text AS plan_id,
               s.graph_id AS graph_id, s.name AS name
        FROM skill_versions v JOIN skills s ON s.id = v.skill_id
        """
    )
    op.execute(
        """
        INSERT INTO task_plans
            (id, graph_id, key, version, name, description, kind, origin, intent,
             todo_id, args_schema, source_skill_version_ids, reusable,
             promoted_from_run_id, created_by_kind, created_by_id, created_at)
        SELECT m.plan_id, m.graph_id, NULL, 1, m.name,
               'Drawn for a skill version that predates M8.', 'ask', 'authored', '[]'::json,
               NULL, '{}'::json, json_build_array(m.version_id), false,
               NULL, 'system', NULL, now()
        FROM _m48 m
        """
    )
    # One node, and it is a person's: a catalogue gap, an unrun planner and a
    # playbook written before any of this are the same shape (SK15).
    op.execute(
        """
        INSERT INTO tasks
            (id, task_plan_id, parent_id, ordinal, key, form, step_key, title, body,
             args, assignee_kind, assignee_id, depends_on, created_at)
        SELECT gen_random_uuid()::text, m.plan_id, NULL, 0, 'do-it', 'human', NULL, m.name, '',
               '{}'::json, NULL, NULL, '[]'::json, now()
        FROM _m48 m
        """
    )
    op.execute("UPDATE skill_versions v SET plan_id = m.plan_id FROM _m48 m WHERE v.id = m.version_id")
    op.execute("DROP TABLE _m48")

    op.alter_column("skill_versions", "plan_id", existing_type=sa.String(36), nullable=False)
    op.create_foreign_key(
        "fk_skill_versions_plan",
        "skill_versions",
        "task_plans",
        ["plan_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint("uq_skill_version_plan", "skill_versions", ["plan_id"])

    # ── 4 · what the planner asked, and what was answered ────────────────────
    op.create_table(
        "skill_version_clarifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "skill_version_id",
            sa.String(36),
            sa.ForeignKey("skill_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("span", sa.Text(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False, server_default=""),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("answered_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_skill_version_clarifications_version",
        "skill_version_clarifications",
        ["skill_version_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_skill_version_clarifications_version", table_name="skill_version_clarifications")
    op.drop_table("skill_version_clarifications")

    # The plans the backfill wrote go with the column that named them; a plan
    # a person drew for a skill is left where it is, because nothing else knows
    # it was ever attached.
    op.execute(
        """
        DELETE FROM task_plans
        WHERE created_by_kind = 'system'
          AND description = 'Drawn for a skill version that predates M8.'
        """
    )
    op.drop_constraint("uq_skill_version_plan", "skill_versions", type_="unique")
    op.drop_constraint("fk_skill_versions_plan", "skill_versions", type_="foreignkey")
    op.drop_column("skill_versions", "plan_id")

    # A draft has nowhere to go in the old shape: it was never published, so it
    # is not a version anything can resolve.
    op.execute("DELETE FROM skill_versions WHERE published_at IS NULL")
    op.drop_column("skill_versions", "created_at")
    op.alter_column("skill_versions", "published_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column("skills", "origin")
