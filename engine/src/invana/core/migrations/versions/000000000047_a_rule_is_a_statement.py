"""A rule is a statement (skills-pass.md **K4** · RU1-RU7).

The other half of what a run is **given** before it runs. A skill is a playbook
that may be offered; a rule is a statement that is always true in its scope, and
neither is enforced — a rule that must be enforced is an envelope bound or a
criterion ([RU5](docs/for-developers/modules/skills/features/rules.md)).

``rules`` has **one axis** ([RU6](docs/for-developers/modules/skills/features/rules.md)):
a rule always belongs to a Graph, and a ``project_id`` is what makes it a working
rule rather than an invariant. ``scope`` and ``kind`` are read off that column
rather than stored, so ``scope='graph', kind='working'`` — two columns'
worth of representable nonsense — cannot exist.

``active`` is on the rule and **not** on the version: deactivating is how a rule
stops applying, and it must leave every version, and every step that cited one,
exactly where it was (RU4). That is also why there is no delete.

``task_runs`` gains the pair ``rules_offered`` · ``rules_cited``, the same two
certainties skills already record (RU7): the first is a fact written by
assembly, the second the model's own claim. Without the first, *never cited*
cannot be told from *never offered*, which is the whole evidence loop.

Nothing is backfilled. No rule has ever existed, so every step that has already
run was offered none — and ``[]`` is the true answer rather than a gap.

Revision ID: 000000000047
Revises: 000000000046
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000047"
down_revision: str | Sequence[str] | None = "000000000046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rule_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("rule_id", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False, server_default=""),
        sa.Column("published_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rule_id", "version", name="uq_rule_version_number"),
    )
    op.create_table(
        "rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        # Null on an invariant. CASCADE: a project's working rules go with the
        # project, and the Graph's invariants are untouched.
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_version_id", sa.String(36), nullable=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rules_graph_id", "rules", ["graph_id"])
    op.create_index("ix_rules_project_id", "rules", ["project_id"])
    op.create_index("ix_rule_versions_rule_id", "rule_versions", ["rule_id"])

    # The two point at each other — which version is live is a property of the
    # rule, not a flag on a row that is meant to be immutable — so the FKs are
    # added once both tables exist.
    op.create_foreign_key(
        "fk_rules_current_version", "rules", "rule_versions", ["current_version_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "rule_versions_rule_id_fkey", "rule_versions", "rules", ["rule_id"], ["id"], ondelete="CASCADE"
    )

    op.add_column("task_runs", sa.Column("rules_offered", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("task_runs", sa.Column("rules_cited", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("task_runs", "rules_cited")
    op.drop_column("task_runs", "rules_offered")
    op.drop_constraint("rule_versions_rule_id_fkey", "rule_versions", type_="foreignkey")
    op.drop_constraint("fk_rules_current_version", "rules", type_="foreignkey")
    op.drop_index("ix_rule_versions_rule_id", table_name="rule_versions")
    op.drop_index("ix_rules_project_id", table_name="rules")
    op.drop_index("ix_rules_graph_id", table_name="rules")
    op.drop_table("rules")
    op.drop_table("rule_versions")
