"""A skill is its versions (docs/for-developers/building-engine/skills-pass.md **K1**).

``skills`` was flat — one row carried the name *and* the prose, and editing it
overwrote what past steps were offered. A step is supposed to record the version
it saw ([SK3](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
which is impossible against a row that changes underneath it.

So the text moves. ``skills`` keeps ``graph_id · name · current_version_id`` —
identity and a pointer — and every word a person wrote lives on an immutable
``skill_versions`` row.

**Every existing skill becomes its own v1**
([SK19](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
its current text, ``published_at`` set to the skill's ``created_at``, and the
head pointed at it. The claim that makes is narrow and the usage surface states
it — *this is the text as it stands*, not that the wording never changed before
versions existed. ``published_by_id`` is **NULL**, because nobody published it:
inventing an author from the Graph's owner would be a fact this migration does
not have.

``task_runs.skills_offered`` and ``.skills_applied`` still hold **bare skill
ids** after this revision and are rewritten to name the version in **K2**, with
the writers that produce them. Rewriting them here would leave the column
holding version ids that the running code does not yet write.

Revision ID: 000000000044
Revises: 000000000043
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000044"
down_revision: str | Sequence[str] | None = "000000000043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1 · where the prose lives now ────────────────────────────────────────
    op.create_table(
        "skill_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("skill_id", sa.String(36), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("when_to_use", sa.Text(), nullable=False, server_default=""),
        sa.Column("published_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("skill_id", "version", name="uq_skill_version_number"),
    )
    op.create_index("ix_skill_versions_skill_id", "skill_versions", ["skill_id"])

    # ── 2 · the head ─────────────────────────────────────────────────────────
    # Nullable in the schema because the skill row is written before the version
    # it points at. SET NULL rather than CASCADE: deleting a version must never
    # take the skill with it.
    op.add_column("skills", sa.Column("current_version_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_skills_current_version",
        "skills",
        "skill_versions",
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ── 3 · every existing skill becomes its own v1 (SK19) ───────────────────
    op.execute(
        """
        INSERT INTO skill_versions
            (id, skill_id, version, description, content, when_to_use, published_by_id, published_at)
        SELECT gen_random_uuid()::text, s.id, 1, s.description, s.content, s.when_to_use, NULL, s.created_at
        FROM skills s
        """
    )
    op.execute(
        """
        UPDATE skills s
        SET current_version_id = v.id
        FROM skill_versions v
        WHERE v.skill_id = s.id AND v.version = 1
        """
    )

    # ── 4 · one source of truth ──────────────────────────────────────────────
    # The columns go rather than staying as a cache: a skill whose row and whose
    # head disagree is the bug this revision exists to make impossible.
    op.drop_column("skills", "description")
    op.drop_column("skills", "content")
    op.drop_column("skills", "when_to_use")


def downgrade() -> None:
    op.add_column("skills", sa.Column("description", sa.Text(), nullable=False, server_default=""))
    op.add_column("skills", sa.Column("content", sa.Text(), nullable=False, server_default=""))
    op.add_column("skills", sa.Column("when_to_use", sa.Text(), nullable=False, server_default=""))

    # The head's text comes back onto the row. Every other version is dropped
    # with the table — there is nowhere flat to put them, which is the point.
    op.execute(
        """
        UPDATE skills s
        SET description = v.description, content = v.content, when_to_use = v.when_to_use
        FROM skill_versions v
        WHERE v.id = s.current_version_id
        """
    )

    op.drop_constraint("fk_skills_current_version", "skills", type_="foreignkey")
    op.drop_column("skills", "current_version_id")
    op.drop_index("ix_skill_versions_skill_id", table_name="skill_versions")
    op.drop_table("skill_versions")
