"""The one writer of the ledger, and the verifier of its chain.

Usage::

    from invana.core import ledger

    await ledger.record(
        db,
        graph_id=run.graph_id,
        actor_kind="agent",
        actor_chain=[{"kind": "person", "id": uid, "name": "ravi"},
                     {"kind": "agent", "id": aid, "name": "Route Auditor"}],
        act="graph.read.query",
        layer="graph",
        touched="graph/Airport",
        touched_line="12 rows",
        verdict="allowed",
        run_id=run.id,
    )

``record`` runs inside the caller's transaction, so a row commits or rolls back
with the act it describes. It takes the Graph's chain head under a lock, gives
the row the next ``seq`` and hashes it over the head's hash — two writers can
never fork the chain, and an edited row breaks every hash after it.

:func:`verify` walks a Graph's rows from the last verified one and records the
result in ``ledger_checks``; the activity clock calls it every ten minutes.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.ledger.models import GENESIS, LedgerCheck, LedgerRow
from invana.core.ledger.querysets import LedgerQuerySet

_qs = LedgerQuerySet()

#: The fields a row's hash covers, in this order. ``id``, ``hash`` and
#: ``prev_hash`` are not content; ``prev_hash`` is the chain, hashed in front.
HASHED = (
    "graph_id",
    "seq",
    "at",
    "actor_kind",
    "actor_user_id",
    "actor_agent_id",
    "actor_chain",
    "act",
    "layer",
    "touched",
    "touched_line",
    "verdict",
    "refused_by",
    "rule",
    "run_id",
    "step_run_id",
    "run_number",
    "where",
    "args",
)


def _canonical(value: Any) -> Any:
    if isinstance(value, datetime):
        stamp = value if value.tzinfo else value.replace(tzinfo=UTC)
        return stamp.astimezone(UTC).isoformat(timespec="microseconds")
    return value


def row_hash(row: LedgerRow, prev_hash: str) -> str:
    """The hash of ``row`` chained on ``prev_hash``."""
    content = {name: _canonical(getattr(row, name)) for name in HASHED}
    body = json.dumps(content, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256((prev_hash + body).encode()).hexdigest()


async def record(
    db: AsyncSession,
    *,
    graph_id: str,
    actor_kind: str,
    act: str,
    layer: str,
    verdict: str,
    actor_chain: list[dict] | None = None,
    actor_user_id: str | None = None,
    actor_agent_id: str | None = None,
    touched: str = "",
    touched_line: str = "",
    refused_by: str | None = None,
    rule: str = "",
    run_id: str | None = None,
    step_run_id: str | None = None,
    run_number: int | None = None,
    where: str = "",
    args: dict | None = None,
    at: datetime | None = None,
) -> LedgerRow:
    """Append one act to the Graph's ledger and return the row."""
    await _qs.lock_graph(db, graph_id)
    head = await _qs.head(db, graph_id)
    row = LedgerRow(
        graph_id=graph_id,
        seq=(head.seq + 1) if head else 1,
        at=at or datetime.now(UTC),
        actor_kind=actor_kind,
        actor_user_id=actor_user_id,
        actor_agent_id=actor_agent_id,
        actor_chain=list(actor_chain or []),
        act=act[:128],
        layer=layer,
        touched=(touched or "")[:512],
        touched_line=(touched_line or "")[:255],
        verdict=verdict,
        refused_by=refused_by,
        rule=(rule or "")[:512],
        run_id=run_id,
        step_run_id=step_run_id,
        run_number=run_number,
        where=(where or "")[:128],
        args=dict(args or {}),
    )
    row.prev_hash = head.hash if head else GENESIS
    row.hash = row_hash(row, row.prev_hash)
    db.add(row)
    await db.flush()
    return row


async def verify(db: AsyncSession, graph_id: str, *, full: bool = False) -> LedgerCheck:
    """Re-hash the Graph's rows from the last verified one and record the result."""
    check = await _qs.check(db, graph_id)
    start = 0 if (full or check is None or not check.ok) else check.last_seq
    prev = GENESIS
    if start:
        anchor = await _qs.at_seq(db, graph_id, start)
        prev = anchor.hash if anchor else GENESIS
        if anchor is None:
            start = 0
    last, broken = start, None
    while broken is None:
        rows = await _qs.after(db, graph_id, last)
        if not rows:
            break
        for row in rows:
            if row.prev_hash != prev or row_hash(row, prev) != row.hash:
                broken = row.seq
                break
            prev, last = row.hash, row.seq
    if check is None:
        check = LedgerCheck(graph_id=graph_id)
        db.add(check)
    check.verified_at = datetime.now(UTC)
    check.ok = broken is None
    check.last_seq = last
    check.broken_seq = broken
    await db.flush()
    return check


async def verify_all(db: AsyncSession) -> None:
    """Verify every Graph that has a ledger — the clock's ten-minute tick."""
    for graph_id in await _qs.graph_ids(db):
        await verify(db, graph_id)
