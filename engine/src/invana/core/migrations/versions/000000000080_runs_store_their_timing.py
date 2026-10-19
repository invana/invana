"""A run stores its own timing.

docs/for-developers/modules/platform/features/metrics-are-stored.md. Five new
columns on ``task_runs``: ``duration_ms`` and ``queue_ms`` on every row,
``work_ms``, ``ask_ms`` and ``wait_ms`` on a root. Existing rows are backfilled
from their timestamps by the same rules the engine applies when a row settles.

Revision ID: 000000000080
Revises: 000000000079
Create Date: 2026-10-19
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "000000000080"
down_revision: str | Sequence[str] | None = "000000000079"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = ("duration_ms", "queue_ms", "work_ms", "ask_ms", "wait_ms")

_runs = sa.table(
    "task_runs",
    sa.column("id", sa.String),
    sa.column("parent_run_id", sa.String),
    sa.column("status", sa.String),
    sa.column("seq", sa.Integer),
    sa.column("iteration", sa.Integer),
    sa.column("attempt", sa.Integer),
    sa.column("queued_at", sa.DateTime(timezone=True)),
    sa.column("started_at", sa.DateTime(timezone=True)),
    sa.column("finished_at", sa.DateTime(timezone=True)),
    *(sa.column(name, sa.Integer) for name in _COLUMNS),
)


def _span(start: datetime | None, end: datetime | None) -> int | None:
    if start is None or end is None:
        return None
    start = start if start.tzinfo else start.replace(tzinfo=UTC)
    end = end if end.tzinfo else end.replace(tzinfo=UTC)
    return max(0, round((end - start).total_seconds() * 1000))


def upgrade() -> None:
    with op.batch_alter_table("task_runs") as batch:
        for name in _COLUMNS:
            batch.add_column(sa.Column(name, sa.Integer(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.select(
            _runs.c.id,
            _runs.c.parent_run_id,
            _runs.c.status,
            _runs.c.seq,
            _runs.c.iteration,
            _runs.c.attempt,
            _runs.c.queued_at,
            _runs.c.started_at,
            _runs.c.finished_at,
        )
    ).all()
    nodes = defaultdict(list)
    for row in rows:
        if row.parent_run_id is not None:
            nodes[row.parent_run_id].append(row)

    updates = []
    for row in rows:
        duration = _span(row.started_at, row.finished_at)
        values = {"b_id": row.id, "duration_ms": duration, "queue_ms": _span(row.queued_at, row.started_at)}
        values.update(work_ms=None, ask_ms=None, wait_ms=None)
        if row.parent_run_id is None and duration is not None:
            ordered = sorted(nodes.get(row.id, []), key=lambda n: (n.seq, n.iteration, n.attempt))
            work = sum(_span(n.started_at, n.finished_at) or 0 for n in ordered if n.status != "needs_input")
            ask = 0
            for i, node in enumerate(ordered):
                if node.status != "needs_input" or node.finished_at is None:
                    continue
                resumed = next((later for later in ordered[i + 1 :] if later.started_at is not None), None)
                if resumed is not None:
                    ask += _span(node.finished_at, resumed.started_at) or 0
            values.update(work_ms=work, ask_ms=ask, wait_ms=max(0, duration - work))
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
