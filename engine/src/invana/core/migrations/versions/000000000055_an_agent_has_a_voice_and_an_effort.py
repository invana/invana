"""An agent has a voice and an effort
(docs/for-developers/modules/agents/features/soul.md SO1 ·
docs/for-developers/modules/agents/features/author-an-agent.md AG16 ·
docs/for-developers/modules/agents/features/envelope-and-budget.md EB9).

``agents.soul``
    who the agent is and how it speaks, as Markdown. Empty is Invana's default
    voice, never no voice (SO3).

``agents.soul_traits``
    the voice dials — ``humour`` · ``formality`` · ``emoji`` · ``greeting``. A
    missing key is its default, so ``{}`` is the default voice.

``agents.effort``
    ``max_steps`` · ``max_replans`` · ``max_clarifications``. Each row is
    **backfilled** from where the number lived before — ``workflow_spec`` first,
    then ``budget`` — so the value a run reads does not move on the way. Both old
    places stay as they are: they are read as a fallback for one release.

The down path drops the three columns. Nothing is lost that the old places do
not still hold, since the backfill copied rather than moved.

Revision ID: 000000000055
Revises: 000000000054
Create Date: 2026-09-25
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000055"
down_revision: str | Sequence[str] | None = "000000000054"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_EFFORT_KEYS = ("max_steps", "max_replans", "max_clarifications")


def _as_json(value) -> dict:
    if value is None:
        return {}
    value = json.loads(value) if isinstance(value, str) else value
    return value if isinstance(value, dict) else {}


def upgrade() -> None:
    with op.batch_alter_table("agents") as batch:
        batch.add_column(sa.Column("soul", sa.Text(), nullable=False, server_default=""))
        batch.add_column(sa.Column("soul_traits", sa.JSON(), nullable=False, server_default="{}"))
        batch.add_column(sa.Column("effort", sa.JSON(), nullable=False, server_default="{}"))

    bind = op.get_bind()
    agents = sa.table(
        "agents",
        sa.column("id", sa.String),
        sa.column("workflow_spec", sa.JSON),
        sa.column("budget", sa.JSON),
        sa.column("effort", sa.JSON),
    )
    for agent_id, raw_spec, raw_budget in bind.execute(sa.select(agents.c.id, agents.c.workflow_spec, agents.c.budget)):
        spec, budget = _as_json(raw_spec), _as_json(raw_budget)
        effort = {}
        for key in _EFFORT_KEYS:
            value = spec.get(key) if spec.get(key) is not None else budget.get(key)
            if value is not None:
                effort[key] = int(value)
        if effort:
            bind.execute(sa.update(agents).where(agents.c.id == agent_id).values(effort=effort))


def downgrade() -> None:
    with op.batch_alter_table("agents") as batch:
        batch.drop_column("effort")
        batch.drop_column("soul_traits")
        batch.drop_column("soul")
