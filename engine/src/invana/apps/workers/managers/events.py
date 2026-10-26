"""Worker events — when · pool · change · why."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.models import WorkerEvent
from invana.apps.workers.querysets.events import WorkerEventQuerySet
from invana.apps.workers.querysets.pools import PoolQuerySet
from invana.apps.workers.querysets.tokens import JoinTokenQuerySet
from invana.apps.workers.schemas import EVENT_LIST, WorkerEventPage, WorkerEventRow
from invana.core.lists import ListParams, Page, applied_filters


def change_text(event: WorkerEvent) -> str:
    """The Change column: *+2 workers* · *w-k8s-04 lost*."""
    detail = event.detail or {}
    if event.change == "replicas":
        delta = int(detail.get("delta", 0))
        return f"{delta:+d} workers"
    worker = detail.get("worker") or "a worker"
    verb = {"joined": "joined", "lost": "lost", "drained": "draining", "stopped": "stopped"}.get(
        event.change, event.change
    )
    return f"{worker} {verb}"


class WorkerEventManager:
    events = WorkerEventQuerySet()
    pools = PoolQuerySet()
    users = JoinTokenQuerySet()

    async def page(self, session: AsyncSession, *, params: ListParams) -> WorkerEventPage:
        found, info = await self.events.page(session, params=params)
        pools = await self.pools.by_ids(session, [e.pool_id for e in found])
        actors = await self.users.users_by_ids(session, [e.actor_id for e in found if e.actor_id])
        items = [
            WorkerEventRow(
                id=e.id,
                at=e.at,
                pool_id=e.pool_id,
                pool=pools[e.pool_id].name if e.pool_id in pools else "",
                worker=(e.detail or {}).get("worker"),
                change=e.change,
                change_text=change_text(e),
                why=e.why,
                actor=actors[e.actor_id].username if e.actor_id in actors else None,
            )
            for e in found
        ]
        return WorkerEventPage(**Page[WorkerEventRow].of(items, info, applied_filters(params, EVENT_LIST)).model_dump())
