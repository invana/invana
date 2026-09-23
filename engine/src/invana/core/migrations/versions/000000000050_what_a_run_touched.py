"""What a run touched (docs/for-developers/building-engine/govern-and-agents-data-model.md § 4).

``run_touches`` is the **indexed projection of the ledger**, not a second record
([GV20](docs/for-developers/modules/govern/spec.md)). Every row derives from
exactly one ``task_stream`` row and carries its ``seq``; the stream stays
authoritative, and the table is rebuildable from it.

It exists because three questions are joins rather than scans, and no amount of
walking a JSON column answers them well:

- *allowed 11 · touched 7 · refused 2*, for one run, on open
- *what B touched that A did not* — across two runs
- *which runs ever reached this participant* — across a Graph

Two columns are worth naming. ``volume`` carries ``rows`` and no second count —
what the query would have returned unsliced costs an unsliced execution, which
is a spend this product does not make ([WO19]). ``query`` carries both
the generated and the executed digest, so the connector's rewrite is visible
rather than taken on trust — digests, not queries: the text lives on the step,
and copying it here would make this a second copy of the trace instead of an
index into it.

Revision ID: 000000000050
Revises: 000000000049
Create Date: 2026-09-20
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000050"
down_revision: str | Sequence[str] | None = "000000000049"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "run_touches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=False),
        # Denormalised from the run so a cross-run query over an address is one
        # index hit rather than a join back through `task_runs`.
        sa.Column("graph_id", sa.String(36), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("step_key", sa.String(64), nullable=True),
        sa.Column("address", sa.String(512), nullable=False),
        sa.Column("layer", sa.String(16), nullable=False),
        sa.Column("sublayer", sa.String(64), nullable=False),
        sa.Column("participant", sa.String(255), nullable=False),
        sa.Column("direction", sa.String(16), nullable=False),
        sa.Column("rule_matched", sa.String(512), nullable=True),
        sa.Column("why", sa.String(255), nullable=True),
        sa.Column("volume", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("applied", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("sent", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("query", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("cost_usd", sa.Float(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        # One row per ledger entry, enforced — which is what makes the rebuild
        # from `task_stream` idempotent rather than a thing to be careful about.
        sa.UniqueConstraint("run_id", "seq", name="uq_run_touch_seq"),
    )
    op.create_index("ix_run_touches_run_id", "run_touches", ["run_id"])
    op.create_index("ix_run_touches_graph_id", "run_touches", ["graph_id"])
    op.create_index("ix_run_touches_address", "run_touches", ["address"])
    op.create_index("ix_run_touch_graph_address", "run_touches", ["graph_id", "address"])
    op.create_index("ix_run_touch_run_direction", "run_touches", ["run_id", "direction"])


def downgrade() -> None:
    op.drop_index("ix_run_touch_run_direction", table_name="run_touches")
    op.drop_index("ix_run_touch_graph_address", table_name="run_touches")
    op.drop_index("ix_run_touches_address", table_name="run_touches")
    op.drop_index("ix_run_touches_graph_id", table_name="run_touches")
    op.drop_index("ix_run_touches_run_id", table_name="run_touches")
    op.drop_table("run_touches")
