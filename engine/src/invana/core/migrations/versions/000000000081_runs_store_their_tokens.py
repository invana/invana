"""A run stores its token totals.

docs/for-developers/modules/platform/features/metrics-are-stored.md. Four new
columns on ``task_runs``: ``tokens`` on every row (``tokens_in + tokens_out``),
and ``run_tokens_in`` · ``run_tokens_out`` · ``run_tokens`` on a finished root —
its own spend plus its direct nodes'. Existing rows are backfilled by the same
rules the engine applies when a row is saved and a run settles.

Revision ID: 000000000081
Revises: 000000000080
Create Date: 2026-10-19
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000081"
down_revision: str | Sequence[str] | None = "000000000080"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = ("tokens", "run_tokens_in", "run_tokens_out", "run_tokens")

_runs = sa.table(
    "task_runs",
    sa.column("id", sa.String),
    sa.column("parent_run_id", sa.String),
    sa.column("finished_at", sa.DateTime(timezone=True)),
    sa.column("tokens_in", sa.Integer),
    sa.column("tokens_out", sa.Integer),
    *(sa.column(name, sa.Integer) for name in _COLUMNS),
)


def upgrade() -> None:
    with op.batch_alter_table("task_runs") as batch:
        for name in _COLUMNS:
            batch.add_column(sa.Column(name, sa.Integer(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.select(_runs.c.id, _runs.c.parent_run_id, _runs.c.finished_at, _runs.c.tokens_in, _runs.c.tokens_out)
    ).all()
    spent: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for row in rows:
        if row.parent_run_id is not None:
            spent[row.parent_run_id][0] += row.tokens_in or 0
            spent[row.parent_run_id][1] += row.tokens_out or 0

    updates = []
    for row in rows:
        own = None if row.tokens_in is None and row.tokens_out is None else (row.tokens_in or 0) + (row.tokens_out or 0)
        values = {"b_id": row.id, "tokens": own, "run_tokens_in": None, "run_tokens_out": None, "run_tokens": None}
        if row.parent_run_id is None and row.finished_at is not None:
            spent_in = (row.tokens_in or 0) + spent[row.id][0]
            spent_out = (row.tokens_out or 0) + spent[row.id][1]
            values.update(
                run_tokens_in=spent_in,
                run_tokens_out=spent_out,
                run_tokens=(spent_in + spent_out) or None,
            )
        updates.append(values)

    if updates:
        bind.execute(
            _runs.update()
            .where(_runs.c.id == sa.bindparam("b_id"))
            .values({name: sa.bindparam(name) for name in _COLUMNS}),
            updates,
        )


def downgrade() -> None:
    with op.batch_alter_table("task_runs") as batch:
        for name in _COLUMNS:
            batch.drop_column(name)
