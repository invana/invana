"""Worker pools — list, add, scale.

docs/for-developers/modules/agents/features/workers.md. A pool is install-wide:
only an install admin adds or changes one, any signed-in user reads. Every
number on a row is computed here from the worker rows and the latest stored
``worker_stats`` row of the pool; Studio formats them.

Usage::

    pools = PoolManager()
    row = await pools.create(session, payload=PoolIn(name="egress", labels=["egress"]), actor=admin)
    row = await pools.update(session, ref="egress", payload=PoolPatch(replicas=6), actor=admin)
    page = await pools.page(session, params=params)
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.managers.numbers import pool_state, require_install_admin
from invana.apps.workers.models import SetBy, WorkerChange, WorkerEvent, WorkerPool
from invana.apps.workers.querysets.events import WorkerEventQuerySet
from invana.apps.workers.querysets.pools import PoolQuerySet
from invana.apps.workers.querysets.stats import WorkerStatQuerySet
from invana.apps.workers.querysets.workers import WorkerQuerySet
from invana.apps.workers.schemas import POOL_LIST, PoolIn, PoolPage, PoolPatch, PoolRow
from invana.core.errors import ConflictError, NotFoundError
from invana.core.lists import ListParams, Page, applied_filters


def _clean(values: Sequence[str]) -> list[str]:
    seen: list[str] = []
    for value in values:
        item = value.strip().lower()
        if item and item not in seen:
            seen.append(item)
    return seen


class PoolManager:
    """Stateless. The session is the first argument of every method."""

    pools = PoolQuerySet()
    workers = WorkerQuerySet()
    stats = WorkerStatQuerySet()
    events = WorkerEventQuerySet()

    async def resolve(self, session: AsyncSession, ref: str) -> WorkerPool:
        """A pool by id or name, or ``NotFoundError``."""
        pool = await self.pools.get_by_ref(session, ref)
        if pool is None:
            raise NotFoundError("No such pool.")
        return pool

    async def rows(self, session: AsyncSession, pools: Sequence[WorkerPool]) -> list[PoolRow]:
        totals = await self.workers.pool_totals(session, since_lost=datetime.now(UTC) - timedelta(hours=24))
        stored = await self.stats.latest(session)
        out: list[PoolRow] = []
        for pool in pools:
            t = totals.get(pool.id, {"workers": 0, "starting": 0, "lost": 0, "slots": 0, "slots_busy": 0})
            stat = stored.get(pool.id)
            queued = stat.ready if stat else 0
            suggested = stat.suggested if stat else 0
            out.append(
                PoolRow(
                    id=pool.id,
                    name=pool.name,
                    runs_on=pool.runs_on,
                    runs_on_detail=self.runs_on_detail(pool, t.get("hosts", 0)),
                    labels=list(pool.labels or []),
                    slots_per_worker=pool.slots_per_worker,
                    plugins=list(pool.plugins or []),
                    secrets=list(pool.secrets or []),
                    egress=list(pool.egress or []),
                    set_by=pool.set_by,
                    replicas=pool.replicas,
                    workers=t["workers"],
                    starting=t["starting"],
                    lost=t["lost"],
                    slots=t["slots"],
                    slots_busy=t["slots_busy"],
                    queued=queued,
                    oldest_s=stat.oldest_s if stat else None,
                    state=pool_state(
                        workers=t["workers"] - t["starting"],
                        slots=t["slots"],
                        slots_busy=t["slots_busy"],
                        queued=queued,
                        suggested=suggested,
                    ),
                    created_at=pool.created_at,
                )
            )
        return out

    @staticmethod
    def runs_on_detail(pool: WorkerPool, hosts: int) -> str:
        """What the pool runs on, in a line — the replicas are *Set by*'s, not this line's."""
        if pool.runs_on == "kubernetes":
            return "invana/worker deployment"
        if pool.runs_on == "docker":
            return f"{hosts} host{'s' if hosts != 1 else ''}"
        return "invana worker"

    async def page(self, session: AsyncSession, *, params: ListParams) -> PoolPage:
        found, info = await self.pools.page(session, params=params)
        items = await self.rows(session, found)
        return PoolPage(**Page[PoolRow].of(items, info, applied_filters(params, POOL_LIST)).model_dump())

    async def get(self, session: AsyncSession, *, ref: str) -> PoolRow:
        pool = await self.resolve(session, ref)
        return (await self.rows(session, [pool]))[0]

    async def create(self, session: AsyncSession, *, payload: PoolIn, actor) -> PoolRow:
        require_install_admin(actor)
        if await self.pools.get_by_name(session, payload.name) is not None:
            raise ConflictError(f"A pool named '{payload.name}' already exists.")
        pool = await self.pools.add(
            session,
            WorkerPool(
                name=payload.name,
                runs_on=payload.runs_on,
                labels=_clean(payload.labels),
                slots_per_worker=payload.slots_per_worker,
                plugins=_clean(payload.plugins),
                secrets=[s.strip() for s in payload.secrets if s.strip()],
                egress=_clean(payload.egress),
                set_by=SetBy.hand.value,
                created_by_id=actor.id,
            ),
        )
        return (await self.rows(session, [pool]))[0]

    async def update(self, session: AsyncSession, *, ref: str, payload: PoolPatch, actor) -> PoolRow:
        """Change a pool's labels, slots, plugins, secrets, egress or declared replicas.

        Declaring replicas records ``set_by = replicas`` and a ``replicas`` event;
        Invana starts nothing — a person does.
        """
        require_install_admin(actor)
        pool = await self.resolve(session, ref)
        given = payload.model_fields_set
        if "labels" in given and payload.labels is not None:
            pool.labels = _clean(payload.labels)
        if "slots_per_worker" in given and payload.slots_per_worker is not None:
            pool.slots_per_worker = payload.slots_per_worker
        if "plugins" in given and payload.plugins is not None:
            pool.plugins = _clean(payload.plugins)
        if "secrets" in given and payload.secrets is not None:
            pool.secrets = [s.strip() for s in payload.secrets if s.strip()]
        if "egress" in given and payload.egress is not None:
            pool.egress = _clean(payload.egress)
        if "replicas" in given and payload.replicas is not None:
            before = pool.replicas or 0
            pool.replicas = payload.replicas
            pool.set_by = SetBy.replicas.value
            await self.events.add(
                session,
                WorkerEvent(
                    pool_id=pool.id,
                    change=WorkerChange.replicas.value,
                    detail={"replicas": payload.replicas, "delta": payload.replicas - before},
                    why=f"Declared {payload.replicas} replicas",
                    actor_id=actor.id,
                ),
            )
        await session.flush()
        return (await self.rows(session, [pool]))[0]
