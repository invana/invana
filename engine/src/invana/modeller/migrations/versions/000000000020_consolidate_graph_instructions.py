"""Consolidate graph "intent" into Graph.instructions; drop the instructions table.

RFC-040. The single ``graphs.intent`` field (the graph's standing guidance) is
renamed to ``graphs.instructions`` — a ChatGPT-/Claude-project-style custom
instructions block. The separate, never-wired ``instructions`` table (named,
prioritized directives) is removed: nothing read it, and it now duplicates the
field. The setup-wizard ``setup_state`` JSON key ``intent`` is renamed to
``instructions`` for existing rows so wizard-completion state survives.

Revision ID: 000000000020
Revises: 00000000001f
Create Date: 2026-06-24
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000020"
down_revision: str | Sequence[str] | None = "00000000001f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Lightweight table handle for the JSON data migration. Declaring the column as
# sa.JSON lets SQLAlchemy serialize/deserialize ``setup_state`` consistently on
# both SQLite (dev, TEXT) and Postgres (prod, JSON) — so the key rename is portable.
_graphs = sa.table(
    "graphs",
    sa.column("id", sa.String),
    sa.column("setup_state", sa.JSON),
)


def _rename_setup_state_key(old: str, new: str) -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.select(_graphs.c.id, _graphs.c.setup_state)).fetchall()
    for row_id, state in rows:
        if not isinstance(state, dict) or old not in state:
            continue
        updated = dict(state)
        updated[new] = updated.pop(old)
        bind.execute(sa.update(_graphs).where(_graphs.c.id == row_id).values(setup_state=updated))


def upgrade() -> None:
    # 1. Rename the field (data-preserving).
    op.alter_column("graphs", "intent", new_column_name="instructions", existing_type=sa.Text())
    # 2. Carry the wizard-completion state across the section rename.
    _rename_setup_state_key("intent", "instructions")
    # 3. Drop the unwired instructions table.
    op.drop_index("ix_instructions_graph_id", table_name="instructions")
    op.drop_table("instructions")


def downgrade() -> None:
    # Recreate the instructions table (DDL mirrors 00000000000c).
    op.create_table(
        "instructions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("graph_id", "name", name="uq_instruction_graph_name"),
    )
    op.create_index("ix_instructions_graph_id", "instructions", ["graph_id"])
    # Reverse the wizard-state key rename, then the column rename.
    _rename_setup_state_key("instructions", "intent")
    op.alter_column("graphs", "instructions", new_column_name="intent", existing_type=sa.Text())
