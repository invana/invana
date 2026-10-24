"""Run numbers and exit reasons, delegation escrow, the ledger, asks and alert rules.

docs/for-developers/modules/agents/features/the-run-page.md ·
modules/agents/features/delegation.md · modules/operate/features/the-ledger.md ·
modules/operate/features/approvals.md.

* ``task_runs`` gains ``number`` (per Graph, root runs only, numbered by
  ``queued_at`` here), ``exit_reason`` (written for every settled root run from
  its status and outcome), ``escrow_tokens`` and ``escrow_returned``.
* ``approvals`` gains ``kind`` · ``asked_by`` · ``wants`` · ``routed_reason`` ·
  ``step_run_id`` · ``scope``; existing rows read as ``send`` (or ``publish``
  for a model publish).
* New tables ``ledger_rows`` · ``ledger_checks`` · ``ledger_exports`` ·
  ``alert_rules``. The ledger starts empty: rows are written from now on.

Revision ID: 000000000085
Revises: 000000000084
Create Date: 2026-10-24
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000085"
down_revision: str | Sequence[str] | None = "000000000084"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("task_runs", sa.Column("number", sa.Integer(), nullable=True))
    op.add_column("task_runs", sa.Column("exit_reason", sa.String(24), nullable=True))
    op.add_column("task_runs", sa.Column("escrow_tokens", sa.Integer(), nullable=True))
    op.add_column("task_runs", sa.Column("escrow_returned", sa.Integer(), nullable=True))
    op.create_index("ix_task_runs_exit_reason", "task_runs", ["exit_reason"])

    op.execute(
        """
        UPDATE task_runs AS t SET number = n.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY graph_id ORDER BY queued_at, id) AS rn
            FROM task_runs WHERE parent_run_id IS NULL
        ) AS n
        WHERE t.id = n.id
        """
    )
    op.execute(
        """
        UPDATE task_runs SET exit_reason = CASE
            WHEN status = 'succeeded' AND outcome = 'cannot_answer' THEN 'cannot_answer'
            WHEN status = 'succeeded' THEN 'served'
            WHEN status = 'cancelled' AND parent_run_id IS NOT NULL THEN 'parent_ended'
            WHEN status = 'cancelled' THEN 'stopped'
            WHEN status = 'failed' THEN 'failed'
            ELSE NULL END
        WHERE status IN ('succeeded', 'cancelled', 'failed')
        """
    )
    op.create_unique_constraint("uq_task_runs_graph_number", "task_runs", ["graph_id", "number"])

    op.add_column("approvals", sa.Column("kind", sa.String(16), nullable=False, server_default="send"))
    op.add_column("approvals", sa.Column("asked_by", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("approvals", sa.Column("wants", sa.String(512), nullable=False, server_default=""))
    op.add_column("approvals", sa.Column("routed_reason", sa.String(64), nullable=False, server_default=""))
    op.add_column("approvals", sa.Column("step_run_id", sa.String(36), nullable=True))
    op.add_column("approvals", sa.Column("scope", sa.String(8), nullable=True))
    op.create_index("ix_approvals_kind", "approvals", ["kind"])
    op.execute("UPDATE approvals SET kind = 'publish' WHERE subject_kind = 'model_publish'")
    op.execute("UPDATE approvals SET wants = title WHERE wants = ''")

    op.create_table(
        "ledger_rows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq", sa.BigInteger(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_kind", sa.String(16), nullable=False),
        sa.Column("actor_user_id", sa.String(36), nullable=True),
        sa.Column("actor_agent_id", sa.String(36), nullable=True),
        sa.Column("actor_chain", sa.JSON(), nullable=False),
        sa.Column("act", sa.String(128), nullable=False),
        sa.Column("layer", sa.String(16), nullable=False),
        sa.Column("touched", sa.String(512), nullable=False),
        sa.Column("touched_line", sa.String(255), nullable=False),
        sa.Column("verdict", sa.String(16), nullable=False),
        sa.Column("refused_by", sa.String(16), nullable=True),
        sa.Column("rule", sa.String(512), nullable=False),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("step_run_id", sa.String(36), nullable=True),
        sa.Column("run_number", sa.Integer(), nullable=True),
        sa.Column("where", sa.String(128), nullable=False),
        sa.Column("args", sa.JSON(), nullable=False),
        sa.Column("hash", sa.String(64), nullable=False),
        sa.Column("prev_hash", sa.String(64), nullable=False),
        sa.UniqueConstraint("graph_id", "seq", name="uq_ledger_rows_graph_seq"),
    )
    op.create_index("ix_ledger_rows_graph_at", "ledger_rows", ["graph_id", "at"])
    op.create_index("ix_ledger_rows_run", "ledger_rows", ["run_id"])
    op.create_index("ix_ledger_rows_touched", "ledger_rows", ["graph_id", "touched"])
    op.create_index("ix_ledger_rows_actor_user_id", "ledger_rows", ["actor_user_id"])
    op.create_index("ix_ledger_rows_actor_agent_id", "ledger_rows", ["actor_agent_id"])

    op.create_table(
        "ledger_checks",
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("last_seq", sa.BigInteger(), nullable=False),
        sa.Column("broken_seq", sa.BigInteger(), nullable=True),
    )
    op.create_table(
        "ledger_exports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_id", sa.String(36), nullable=True),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("format", sa.String(8), nullable=False),
        sa.Column("rows", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_ledger_exports_graph_id", "ledger_exports", ["graph_id"])

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("match", sa.JSON(), nullable=False),
        sa.Column("notify_user_ids", sa.JSON(), nullable=False),
        sa.Column("last_fired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seq", sa.Integer(), nullable=False),
        sa.Column("created_by_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("graph_id", "name", name="uq_alert_rule_name"),
    )
    op.create_index("ix_alert_rules_graph_id", "alert_rules", ["graph_id"])


def downgrade() -> None:
    op.drop_table("alert_rules")
    op.drop_table("ledger_exports")
    op.drop_table("ledger_checks")
    op.drop_table("ledger_rows")
    op.drop_index("ix_approvals_kind", table_name="approvals")
    for col in ("scope", "step_run_id", "routed_reason", "wants", "asked_by", "kind"):
        op.drop_column("approvals", col)
    op.drop_constraint("uq_task_runs_graph_number", "task_runs", type_="unique")
    op.drop_index("ix_task_runs_exit_reason", table_name="task_runs")
    for col in ("escrow_returned", "escrow_tokens", "exit_reason", "number"):
        op.drop_column("task_runs", col)
