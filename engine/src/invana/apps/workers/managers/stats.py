"""The numbers Workers shows, stored every 30 s.

docs/for-developers/modules/agents/features/workers.md C5. One ``worker_stats``
row per pool per bucket: workers and slots from the worker rows, ready steps
and the oldest wait from the queue, envelopes finished from the outcomes
workers posted, and *Suggested* — ready steps ÷ slots a worker, averaged over
the last 10 minutes. Everything Studio shows on the Pools and Capacity tabs
reads these rows.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.managers.numbers import SUGGEST_WINDOW_S, suggested_workers
from invana.apps.workers.models import WorkerStat
from invana.apps.workers.querysets.pools import PoolQuerySet
from invana.apps.workers.querysets.queue import QueueQuerySet
from invana.apps.workers.querysets.stats import WorkerStatQuerySet
from invana.apps.workers.querysets.workers import WorkerQuerySet
from invana.apps.workers.queues import covers

BUCKET_S = 30
KEEP = timedelta(days=8)


def bucket_of(moment: datetime) -> datetime:
    """The start of the 30 s bucket ``moment`` falls in."""
    seconds = int(moment.timestamp()) // BUCKET_S * BUCKET_S
    return datetime.fromtimestamp(seconds, UTC)


class WorkerStatsManager:
    pools = PoolQuerySet()
    workers = WorkerQuerySet()
    stats = WorkerStatQuerySet()
    queue = QueueQuerySet()

    async def record(self, session: AsyncSession, *, now: datetime | None = None, queue_known: bool = True) -> int:
        """Write this bucket's row for every pool that has none yet; returns how many were written."""
        now = now or datetime.now(UTC)
        at = bucket_of(now)
        pools = await self.pools.all(session)
        totals = await self.workers.pool_totals(session, since_lost=now - timedelta(hours=24))
        waiting = await self.queue.todo_by_queue(session) if queue_known else []
        written = 0
        for pool in pools:
            if await self.stats.exists(session, pool.id, at):
                continue
            t = totals.get(pool.id, {"workers": 0, "starting": 0, "lost": 0, "slots": 0, "slots_busy": 0})
            mine = [(n, oldest) for name, n, oldest in waiting if covers(pool.labels or [], name)]
            ready = sum(n for n, _ in mine)
            ages = [o for _, o in mine if o is not None]
            history = await self.stats.ready_since(session, pool.id, now - timedelta(seconds=SUGGEST_WINDOW_S))
            await self.stats.add(
                session,
                WorkerStat(
                    pool_id=pool.id,
                    at=at,
                    workers=t["workers"] - t["starting"],
                    starting=t["starting"],
                    lost=t["lost"],
                    slots=t["slots"],
                    slots_busy=t["slots_busy"],
                    ready=ready,
                    oldest_s=max(ages) if ages else None,
                    envelopes=await self.queue.pool_finished(session, pool.id, at - timedelta(seconds=BUCKET_S), at),
                    suggested=suggested_workers([*history, ready], pool.slots_per_worker),
                ),
            )
            written += 1
        await self.stats.prune_before(session, now - KEEP)
        return written
