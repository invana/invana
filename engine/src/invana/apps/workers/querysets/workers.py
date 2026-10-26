"""Queries behind workers."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.models import Worker, WorkerState
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select

#: States in which a worker holds a place in its pool and answers heartbeats.
LIVE = (WorkerState.starting.value, WorkerState.busy.value, WorkerState.idle.value, WorkerState.draining.value)
#: States that may take a lease.
LEASING = (WorkerState.starting.value, WorkerState.busy.value, WorkerState.idle.value)


class WorkerQuerySet:
    async def get(self, session: AsyncSession, worker_id: str) -> Worker | None:
        return await session.get(Worker, worker_id)

    async def get_by_ref(self, session: AsyncSession, ref: str) -> Worker | None:
        """A worker by id, or by name (the newest of that name)."""
        found = await self.get(session, ref)
        if found is not None:
            return found
        stmt = select(Worker).where(Worker.name == ref).order_by(Worker.joined_at.desc()).limit(1)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def by_credential(self, session: AsyncSession, credential_hash: str) -> Worker | None:
        """The worker holding this credential, or whose previous one it is."""
        stmt = select(Worker).where(
            or_(Worker.credential_hash == credential_hash, Worker.previous_credential_hash == credential_hash)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def latest_via(self, session: AsyncSession, token_id: str) -> Worker | None:
        """The worker that joined most recently on a join token."""
        stmt = select(Worker).where(Worker.joined_via == token_id).order_by(Worker.joined_at.desc()).limit(1)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def live_name_taken(self, session: AsyncSession, name: str) -> bool:
        stmt = select(func.count()).select_from(Worker).where(Worker.name == name, Worker.state.in_(LIVE))
        return bool((await session.execute(stmt)).scalar_one())

    async def count_in_pool(self, session: AsyncSession, pool_id: str) -> int:
        stmt = select(func.count()).select_from(Worker).where(Worker.pool_id == pool_id)
        return int((await session.execute(stmt)).scalar_one())

    async def names_taken(self, session: AsyncSession, names: Sequence[str]) -> set[str]:
        stmt = select(Worker.name).where(Worker.name.in_(list(names)))
        return set((await session.execute(stmt)).scalars().all())

    async def live_in_pool(self, session: AsyncSession, pool_id: str) -> list[Worker]:
        stmt = select(Worker).where(Worker.pool_id == pool_id, Worker.state.in_(LIVE)).order_by(Worker.name)
        return list((await session.execute(stmt)).scalars().all())

    async def live(self, session: AsyncSession) -> list[Worker]:
        stmt = select(Worker).where(Worker.state.in_(LIVE))
        return list((await session.execute(stmt)).scalars().all())

    async def silent_since(self, session: AsyncSession, cutoff: datetime) -> list[Worker]:
        """Live workers whose last heartbeat (or join, before the first) is older than ``cutoff``."""
        seen = func.coalesce(Worker.last_heartbeat_at, Worker.joined_at)
        stmt = select(Worker).where(Worker.state.in_(LIVE), seen < cutoff)
        return list((await session.execute(stmt)).scalars().all())

    async def pool_totals(self, session: AsyncSession, *, since_lost: datetime) -> dict[str, dict[str, int]]:
        """Per pool: workers, starting, lost (since ``since_lost``), slots, slots_busy — from the worker rows."""
        stmt = select(
            Worker.pool_id,
            Worker.state,
            func.count(),
            func.coalesce(func.sum(Worker.slots), 0),
            func.coalesce(func.sum(Worker.slots_busy), 0),
        ).group_by(Worker.pool_id, Worker.state)
        out: dict[str, dict[str, int]] = {}
        for pool_id, state, n, slots, busy in (await session.execute(stmt)).all():
            row = out.setdefault(pool_id, {"workers": 0, "starting": 0, "lost": 0, "slots": 0, "slots_busy": 0})
            if state == WorkerState.starting.value:
                row["starting"] += n
                row["workers"] += n
            elif state in LIVE:
                row["workers"] += n
                row["slots"] += int(slots)
                row["slots_busy"] += int(busy)
        lost = select(Worker.pool_id, func.count()).where(
            Worker.state == WorkerState.lost.value, Worker.last_heartbeat_at >= since_lost
        )
        for pool_id, n in (await session.execute(lost.group_by(Worker.pool_id))).all():
            out.setdefault(pool_id, {"workers": 0, "starting": 0, "lost": 0, "slots": 0, "slots_busy": 0})["lost"] = n
        return out

    async def state_counts(self, session: AsyncSession, *, pool_id: str | None = None) -> dict[str, int]:
        stmt = select(Worker.state, func.count()).group_by(Worker.state)
        if pool_id:
            stmt = stmt.where(Worker.pool_id == pool_id)
        return dict((await session.execute(stmt)).all())

    async def page(self, session: AsyncSession, *, params: ListParams) -> tuple[Sequence[Worker], PageInfo]:
        unfiltered = select(Worker)
        stmt = unfiltered
        if params.q:
            stmt = stmt.where(contains(params.q, Worker.name, Worker.node))
        if pools := params.values("pool_id"):
            stmt = stmt.where(Worker.pool_id.in_(pools))
        if states := params.values("state"):
            stmt = stmt.where(Worker.state.in_(states))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"name": Worker.name, "joined_at": Worker.joined_at},
            id_column=Worker.id,
        )

    async def add(self, session: AsyncSession, worker: Worker) -> Worker:
        session.add(worker)
        await session.flush()
        return worker
