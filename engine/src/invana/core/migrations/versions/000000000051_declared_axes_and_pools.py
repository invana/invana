"""Declared axes, and the pools (data-model pass § 5.3 · § 5.5).

Two independent columns, both of which a Govern surface reads.

``graph_versions.axes`` is what makes a slice legal. A published model version
declares which property carries valid time, which carries geography, and which
named properties are selectable dimensions
([DM6](docs/for-developers/modules/connect-and-model/features/domain-models.md)).
``{}`` is the default and means *nothing is selectable*: a world asking to slice
along an axis this version never declared is refused naming the model and the
axis, never silently ignored
([GV14](docs/for-developers/modules/govern/spec.md)). Nothing is inferred from a
property's name or type — that would make *which rows did this run see* depend
on a guess.

``graphs.pools`` names the three scarce things a run draws on while it holds its
slot ([CC8](docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
Three and not one, because one number would have to be the smallest of them: a
lane takes an ``llm`` slot, a query takes a ``graphdb`` connection, and a graph
algorithm takes a ``heavy`` one. A refusal names the pool rather than reading as
a query error.

Revision ID: 000000000051
Revises: 000000000050
Create Date: 2026-09-20
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000051"
down_revision: str | Sequence[str] | None = "000000000050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Sized for one machine, which is what a fresh install is.
_DEFAULT_POOLS = '{"llm": 20, "graphdb": 50, "heavy": 4}'


def upgrade() -> None:
    with op.batch_alter_table("graph_versions") as batch:
        batch.add_column(sa.Column("axes", sa.JSON(), nullable=False, server_default="{}"))

    with op.batch_alter_table("graphs") as batch:
        batch.add_column(sa.Column("pools", sa.JSON(), nullable=False, server_default=_DEFAULT_POOLS))


def downgrade() -> None:
    with op.batch_alter_table("graphs") as batch:
        batch.drop_column("pools")
    with op.batch_alter_table("graph_versions") as batch:
        batch.drop_column("axes")
