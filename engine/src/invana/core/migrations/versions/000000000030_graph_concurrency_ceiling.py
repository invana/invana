"""A ceiling on how many thinkings run at once in a Graph (S12e).

A budget bounds one agent's spend. Nothing bounded the Graph
(docs/for-developers/modules/agents/features/concurrency-and-contention.md): ten
agents, each inside its own ceiling, are still ten concurrent query loads, ten
claims on one provider's rate limit, and ten connections from a pool that has
fewer.

``max_concurrent_thinkings`` defaults to 4 — a number that suits one machine —
and ``concurrency_policy`` says what happens at the ceiling: ``queue`` waits for
a slot, ``refuse`` says so immediately. Stated on the Graph rather than guessed
per caller (CC2).

Revision ID: 000000000030
Revises: 00000000002f
Create Date: 2026-09-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000030"
down_revision: str | Sequence[str] | None = "00000000002f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("graphs") as batch:
        batch.add_column(sa.Column("max_concurrent_thinkings", sa.Integer(), nullable=False, server_default="4"))
        batch.add_column(sa.Column("concurrency_policy", sa.String(8), nullable=False, server_default="queue"))


def downgrade() -> None:
    with op.batch_alter_table("graphs") as batch:
        batch.drop_column("concurrency_policy")
        batch.drop_column("max_concurrent_thinkings")
