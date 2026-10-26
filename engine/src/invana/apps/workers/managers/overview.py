"""The Pools page tiles and the Capacity tab.

docs/for-developers/modules/agents/features/workers.md C2 · C5. Counts of
workers and slots come from the worker rows; what waits, what finished and what
is suggested come from the ``worker_stats`` rows the gateway sweep writes every
30 s. Nothing is derived by Studio.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.managers.numbers import pool_state
from invana.apps.workers.managers.pools import PoolManager
from invana.apps.workers.querysets.events import WorkerEventQuerySet
from invana.apps.workers.querysets.queue import QueueQuerySet
from invana.apps.workers.querysets.stats import WorkerStatQuerySet
from invana.apps.workers.querysets.workers import LEASING, WorkerQuerySet
from invana.apps.workers.queues import labels_of
from invana.apps.workers.schemas import (
    Capacity,
    CapacityRow,
    PoolsOverview,
    PoolTotals,
    QueuePoint,
    SeriesMark,
    SeriesPoint,
)
from invana.core.settings import settings


class OverviewManager:
    pools = PoolManager()
    workers = WorkerQuerySet()
    stats = WorkerStatQuerySet()
    events = WorkerEventQuerySet()
    queue = QueueQuerySet()

    async def overview(self, session: AsyncSession) -> PoolsOverview:
        now = datetime.now(UTC)
        rows = await self.pools.rows(session, await self.pools.pools.all(session))
        stored = await self.stats.latest(session)
        slots = sum(r.slots for r in rows)
        busy = sum(r.slots_busy for r in rows)
        oldest = [r.oldest_s for r in rows if r.oldest_s is not None]

        per_minute = await self.stats.envelopes_since(session, now - timedelta(seconds=60))
        history_from = await self.stats.first_at(session)
        vs_7d: int | None = None
        if history_from is not None:
            span_min = max(1.0, (now - max(history_from, now - timedelta(days=7))).total_seconds() / 60)
            average = await self.stats.envelopes_since(session, now - timedelta(days=7)) / span_min
            if average > 0:
                vs_7d = round((per_minute - average) / average * 100)

        lost_24h = await self.events.count_lost_since(session, now - timedelta(hours=24))
        last_lost = (await self.events.since(session, now - timedelta(hours=24), change="lost"))[:1]
        series = await self.stats.workers_series(session, now - timedelta(minutes=30))
        marks = await self.events.since(session, now - timedelta(minutes=30))
        totals = PoolTotals(
            workers=sum(r.workers for r in rows),
            starting=sum(r.starting for r in rows),
            lost=sum(r.lost for r in rows),
            slots=slots,
            slots_busy=busy,
            busy_pct=round(busy / slots * 100) if slots else None,
            queued=sum(s.ready for s in stored.values()),
            oldest_s=max(oldest) if oldest else None,
            envelopes_a_minute=per_minute,
            envelopes_vs_7d_pct=vs_7d,
            lost_24h=lost_24h,
            lost_24h_last=(last_lost[0].detail or {}).get("worker") if last_lost else None,
        )
        return PoolsOverview(
            executor=settings.executor,
            totals=totals,
            series=[SeriesPoint(at=at, workers=n) for at, n in series],
            marks=[
                SeriesMark(
                    at=e.at,
                    label=e.why if e.change == "replicas" else (e.detail or {}).get("worker") or e.change,
                )
                for e in reversed(marks)
                if e.change in ("joined", "lost", "stopped", "replicas")
            ],
        )

    async def capacity(self, session: AsyncSession) -> Capacity:
        """Per pool: what waits, what is suggested, and the label no live pool carries."""
        pools = await self.pools.pools.all(session)
        rows = {r.id: r for r in await self.pools.rows(session, pools)}
        stored = await self.stats.latest(session)
        unroutable = await self._unroutable(session, pools) if settings.executor == "procrastinate" else {}
        out: list[CapacityRow] = []
        for pool in pools:
            row, stat = rows[pool.id], stored.get(pool.id)
            suggested = stat.suggested if stat else 0
            more = suggested - (row.workers - row.starting)
            callout = None
            if row.state == "short" and more > 0:
                callout = f"{more} more {pool.runs_on} workers would clear it"
            out.append(
                CapacityRow(
                    pool_id=pool.id,
                    pool=pool.name,
                    runs_on=pool.runs_on,
                    ready=row.queued,
                    oldest_s=row.oldest_s,
                    workers=row.workers - row.starting,
                    suggested=suggested,
                    state=pool_state(
                        workers=row.workers - row.starting,
                        slots=row.slots,
                        slots_busy=row.slots_busy,
                        queued=row.queued,
                        suggested=suggested,
                    ),
                    callout=callout,
                    unroutable_label=unroutable.get(pool.id),
                )
            )
        short = next((r for r in out if r.state == "short"), None)
        series = (
            await self.stats.pool_series(session, short.pool_id, datetime.now(UTC) - timedelta(minutes=10))
            if short
            else []
        )
        return Capacity(
            rows=out,
            computed_at=max((s.at for s in stored.values()), default=None),
            series_pool_id=short.pool_id if short else None,
            series=[QueuePoint(at=at, ready=ready, workers=n) for at, ready, n in series],
        )

    async def _unroutable(self, session: AsyncSession, pools) -> dict[str, str]:
        """Pool id -> a label steps wait for that no live worker carries.

        Attached to the pool whose labels overlap the waiting queue most, since a
        capacity row belongs to a pool.
        """
        live = await self.workers.live(session)
        carried = [set(w.labels or []) for w in live if w.state in LEASING]
        out: dict[str, str] = {}
        for queue, _n, _oldest in await self.queue.todo_by_queue(session):
            needed = labels_of(queue)
            if not needed or any(needed <= have for have in carried):
                continue
            everywhere = set().union(*carried) if carried else set()
            missing = sorted(needed - everywhere) or sorted(needed)
            best = max(pools, key=lambda p: (len(set(p.labels or []) & needed), -len(p.name)), default=None)
            if best is not None:
                out.setdefault(best.id, missing[0])
        return out
