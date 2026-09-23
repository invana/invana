"""A binding is a row (skills-pass.md **K3** · BN6).

``agents.skill_ids`` was a JSON array: the whole bound set replaced on every save,
with nothing to attribute and nowhere to refuse. A bind that must name **which**
skill it rejected, and why, has nothing to hold on to when the request is a list
([BN5](docs/for-developers/modules/skills/features/bindings.md)).

``skill_bindings`` is that row — ``skill_id · agent_id · bound_by_id ·
bound_at`` — and it belongs to **Skills**, not to Agents: Skills is an
independent module that agents bind to, so the table is named for what it binds
rather than for the pair.

Every id in every array becomes a row. ``bound_by_id`` is **NULL** and
``bound_at`` is the agent's ``created_at``: nobody recorded who bound these or
when, and the honest answer to *who* is nothing rather than the agent's author.

An id naming a skill that no longer exists is **dropped** — unlike the dangling
ids in ``task_runs``, which are a record of what happened, a binding is a
statement about what happens *next*, and a binding to nothing has nothing to
offer. The FK would refuse it anyway.

Revision ID: 000000000046
Revises: 000000000045
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000046"
down_revision: str | Sequence[str] | None = "000000000045"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "skill_bindings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("skill_id", sa.String(36), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.String(36), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bound_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("bound_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("skill_id", "agent_id", name="uq_skill_binding"),
    )
    op.create_index("ix_skill_bindings_skill_id", "skill_bindings", ["skill_id"])
    op.create_index("ix_skill_bindings_agent_id", "skill_bindings", ["agent_id"])

    # The join to `skills` is what drops an id that names nothing, and the
    # DISTINCT is what survives an array that listed the same skill twice.
    op.execute(
        """
        INSERT INTO skill_bindings (id, skill_id, agent_id, bound_by_id, bound_at)
        SELECT DISTINCT ON (a.id, s.id) gen_random_uuid()::text, s.id, a.id, NULL, a.created_at
        FROM agents a
        JOIN json_array_elements_text(a.skill_ids) AS e(value) ON TRUE
        JOIN skills s ON s.id = e.value AND s.graph_id = a.graph_id
        """
    )

    op.drop_column("agents", "skill_ids")


def downgrade() -> None:
    op.add_column("agents", sa.Column("skill_ids", sa.JSON(), nullable=False, server_default="[]"))
    op.execute(
        """
        UPDATE agents a
        SET skill_ids = COALESCE((
            SELECT json_agg(b.skill_id ORDER BY b.bound_at)
            FROM skill_bindings b
            WHERE b.agent_id = a.id
        ), '[]'::json)
        """
    )
    op.drop_index("ix_skill_bindings_agent_id", table_name="skill_bindings")
    op.drop_index("ix_skill_bindings_skill_id", table_name="skill_bindings")
    op.drop_table("skill_bindings")
