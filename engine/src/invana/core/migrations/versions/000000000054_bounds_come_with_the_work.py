"""Bounds come with the work (docs/for-developers/modules/agents/features/author-an-agent.md AG24 · AG26).

An agent binds no world. What a piece of work may see, and what it may spend,
come from what opens the run — for a thread, the session
([AS5](docs/for-developers/modules/ask/spec.md)).

``agents.lens_id``
    dropped. Each agent that carried a world gets a guardrail scoped
    ``agent:<id>`` holding that world's rules, cast and closed layers, so
    nothing the agent could reach widens on the way (AG26). A guardrail is in
    force on every run the agent opens, which is exactly what the world column
    did.

``sessions.lens_id``
    the world every ask in the thread starts in. **No FK**: a deleted world
    leaves the id behind, so the chip can say the world is gone rather than
    silently reading *Everything* as though nobody had picked one.

``sessions.max_cost_usd_run``
    the thread's spend per run, capped by the agent's own at write.

**The down path is lossy and says so.** ``agents.lens_id`` comes back empty and
the seeded guardrails stay — removing a bound on the way down would widen every
agent it touched.

Revision ID: 000000000054
Revises: 000000000053
Create Date: 2026-09-25
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "000000000054"
down_revision: str | Sequence[str] | None = "000000000053"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _as_json(value, default):
    if value is None:
        return default
    return json.loads(value) if isinstance(value, str) else value


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)

    # ── 1 · the session carries the work's bounds ───────────────────────────
    with op.batch_alter_table("sessions") as batch:
        batch.add_column(sa.Column("lens_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("max_cost_usd_run", sa.Float(), nullable=True))

    # ── 2 · an agent's world becomes its guardrail ───────────────────────────
    held = bind.execute(
        sa.text(
            "SELECT a.id AS agent_id, a.graph_id, a.name AS agent_name, "
            'l.name AS world_name, l.rules, l."cast", l.closed_layers, l.as_of '
            "FROM agents a JOIN lenses l ON l.id = a.lens_id"
        )
    ).all()
    for row in held:
        bind.execute(
            sa.text(
                "INSERT INTO lenses "
                '(id, graph_id, kind, key, name, scope, rules, "cast", closed_layers, as_of, version, '
                "created_at, updated_at) "
                "VALUES (:id, :graph_id, 'guardrail', :key, :name, :scope, :rules, :cast, :closed, :as_of, 1, "
                ":now, :now)"
            ),
            {
                "id": str(uuid.uuid4()),
                "graph_id": row.graph_id,
                # Unique per Graph, and never a slug a person would type.
                "key": f"agent-{row.agent_id}",
                "name": row.world_name or f"{row.agent_name}'s world",
                "scope": f"agent:{row.agent_id}",
                "rules": json.dumps(_as_json(row.rules, [])),
                "cast": json.dumps(_as_json(row.cast, {})),
                "closed": json.dumps(_as_json(row.closed_layers, [])),
                "as_of": row.as_of,
                "now": now,
            },
        )

    op.drop_index("ix_agents_lens_id", table_name="agents")
    with op.batch_alter_table("agents") as batch:
        batch.drop_constraint("fk_agents_lens_id", type_="foreignkey")
        batch.drop_column("lens_id")


def downgrade() -> None:
    """**Lossy.** The column returns empty; the seeded guardrails stay."""
    with op.batch_alter_table("agents") as batch:
        batch.add_column(sa.Column("lens_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_agents_lens_id", "lenses", ["lens_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_agents_lens_id", "agents", ["lens_id"])

    with op.batch_alter_table("sessions") as batch:
        batch.drop_column("max_cost_usd_run")
        batch.drop_column("lens_id")
