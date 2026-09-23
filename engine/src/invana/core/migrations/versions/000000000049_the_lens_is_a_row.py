"""The lens is a row (docs/for-developers/building-engine/govern-and-agents-data-model.md § 3).

Govern has had columns waiting for it since ``000000000039``: ``task_runs``
carries ``lens_id`` and ``lens_snapshot``, and nothing has ever written to them
because there was no table to point at. This adds it.

**One table for two things.** A *world* people pick per question and a
*guardrail* always in force are the same row, separated by ``kind`` and nothing
else ([GV1](docs/for-developers/modules/govern/spec.md)) — so there is one
enforcement path, one document frozen onto a run, and promotion is a field
change rather than a re-authoring.

Three shapes come with it:

``agents.lens_id``
    the third bound, beside the envelope and the budget. ``RESTRICT``, because
    widening an agent by deleting the world it worked in is the opposite of
    what a bound is for.

``graph_members.can_edit_guardrails``
    the one field-level permission in the product
    ([GR5](docs/for-developers/modules/govern/features/guardrails.md)). Every
    member still *reads* every rule — a bound nobody may read is a bound nobody
    can work within — and the Graph's owner is backfilled as the first holder,
    so a Graph never has none.

Nothing is dropped here, and nothing existing changes meaning. A Graph that
never opens the Govern panel behaves exactly as it did: no lens, no guardrail,
the widest state, which is what [GV7] already says the default is.

Revision ID: 000000000049
Revises: 000000000048
Create Date: 2026-09-20
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000049"
down_revision: str | Sequence[str] | None = "000000000048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1 · the one record ───────────────────────────────────────────────────
    op.create_table(
        "lenses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="world"),
        # NULL is unnamed, attached to its run, and private to whoever ran it.
        # Setting it is the write that publishes (WO1).
        sa.Column("key", sa.String(128), nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("scope", sa.String(64), nullable=True),
        sa.Column("rules", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("cast", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("closed_layers", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_in_run_id", sa.String(36), nullable=True),
        sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        # Plain, not partial: SQL NULLs are distinct, so any number of unnamed
        # lenses coexist while two named the same thing collide — which is the
        # refusal on `key` that worlds.md promises.
        sa.UniqueConstraint("graph_id", "key", name="uq_lens_graph_key"),
        sa.CheckConstraint(
            "(kind = 'guardrail' AND scope IS NOT NULL AND key IS NOT NULL) OR (kind = 'world' AND scope IS NULL)",
            name="ck_lens_kind_shape",
        ),
    )
    op.create_index("ix_lenses_graph_id", "lenses", ["graph_id"])
    op.create_index("ix_lenses_created_in_run_id", "lenses", ["created_in_run_id"])
    op.create_index("ix_lens_graph_kind", "lenses", ["graph_id", "kind"])

    # ── 2 · the agent's third bound ──────────────────────────────────────────
    with op.batch_alter_table("agents") as batch:
        batch.add_column(sa.Column("lens_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_agents_lens_id", "lenses", ["lens_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_agents_lens_id", "agents", ["lens_id"])

    # ── 3 · the one permission, and its first holder ─────────────────────────
    with op.batch_alter_table("graph_members") as batch:
        batch.add_column(sa.Column("can_edit_guardrails", sa.Boolean(), nullable=False, server_default=sa.false()))
    # The Graph's owner holds it, so a Graph never has nobody who may edit its
    # bounds. Revoking the last holder is refused at the manager, and this is
    # what makes that refusal have something to protect.
    op.execute(
        """
        UPDATE graph_members
           SET can_edit_guardrails = true
         WHERE (graph_id, user_id) IN (
               SELECT id, created_by_id FROM graphs WHERE created_by_id IS NOT NULL
         )
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("graph_members") as batch:
        batch.drop_column("can_edit_guardrails")

    op.drop_index("ix_agents_lens_id", table_name="agents")
    with op.batch_alter_table("agents") as batch:
        batch.drop_constraint("fk_agents_lens_id", type_="foreignkey")
        batch.drop_column("lens_id")

    op.drop_index("ix_lens_graph_kind", table_name="lenses")
    op.drop_index("ix_lenses_created_in_run_id", table_name="lenses")
    op.drop_index("ix_lenses_graph_id", table_name="lenses")
    op.drop_table("lenses")
