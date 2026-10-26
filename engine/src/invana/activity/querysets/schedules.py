"""Queries behind schedules and their firings (docs/for-developers/modules/operate/features/schedules.md)."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import FiringOutcome, Schedule, ScheduleFiring, ScheduleStatus
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select
from invana.runtime.models import TaskRun


class ScheduleQuerySet:
    async def get(self, session: AsyncSession, *, graph_id: str, schedule_id: str) -> Schedule | None:
        row = await session.get(Schedule, schedule_id)
        return row if row is not None and row.graph_id == graph_id else None

    async def by_ref(self, session: AsyncSession, *, graph_id: str, ref: str) -> Schedule | None:
        """A schedule by id or by name."""
        stmt = select(Schedule).where(Schedule.graph_id == graph_id, (Schedule.id == ref) | (Schedule.name == ref))
        return (await session.execute(stmt)).scalars().first()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[Schedule]:
        stmt = select(Schedule).where(Schedule.graph_id == graph_id).order_by(Schedule.name)
        return list((await session.execute(stmt)).scalars())

    async def worlds_by_schedule(
        self, session: AsyncSession, *, graph_id: str
    ) -> list[tuple[str, str, frozenset[str | None]]]:
        """``(id, name, worlds)`` per schedule — the worlds its fired runs were asked in.

        ``None`` is *no world*. A schedule that has not fired yet asks in no
        world, which is where every firing starts.
        """
        schedules = await self.list_for_graph(session, graph_id=graph_id)
        stmt = (
            select(ScheduleFiring.schedule_id, TaskRun.lens_id)
            .join(TaskRun, TaskRun.id == ScheduleFiring.run_id)
            .where(ScheduleFiring.graph_id == graph_id)
            .distinct()
        )
        seen: dict[str, set[str | None]] = {}
        for schedule_id, lens_id in (await session.execute(stmt)).all():
            seen.setdefault(schedule_id, set()).add(lens_id)
        return [(s.id, s.name, frozenset(seen.get(s.id) or {None})) for s in schedules]

    async def active_for_agent(self, session: AsyncSession, *, agent_id: str) -> list[Schedule]:
        """The active schedules that start ``agent_id``, by name."""
        stmt = (
            select(Schedule)
            .where(Schedule.agent_id == agent_id, Schedule.status == ScheduleStatus.active.value)
            .order_by(Schedule.name)
        )
        return list((await session.execute(stmt)).scalars())

    async def page_for_graph(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[Schedule], PageInfo]:
        """One page of the Graph's schedules. ``enabled`` is an active schedule; not enabled, a paused one.

        ``agent_id`` narrows to the schedules that start those agents.
        """
        unfiltered = select(Schedule).where(Schedule.graph_id == graph_id)
        stmt = unfiltered
        enabled = set(params.values("enabled"))
        if enabled == {"true"}:
            stmt = stmt.where(Schedule.status == ScheduleStatus.active.value)
        elif enabled == {"false"}:
            stmt = stmt.where(Schedule.status != ScheduleStatus.active.value)
        if agent_ids := params.values("agent_id"):
            stmt = stmt.where(Schedule.agent_id.in_(agent_ids))
        if params.q:
            stmt = stmt.where(contains(params.q, Schedule.name))
        return await page_of_select(
            session, stmt, params, unfiltered=unfiltered, sorts={"name": Schedule.name}, id_column=Schedule.id
        )

    async def paused_count(self, session: AsyncSession, *, graph_id: str) -> int:
        """How many of the Graph's schedules are not active."""
        stmt = select(func.count()).where(Schedule.graph_id == graph_id, Schedule.status != ScheduleStatus.active.value)
        return int((await session.execute(stmt)).scalar_one())

    async def naming_channel(self, session: AsyncSession, *, graph_id: str) -> list[Schedule]:
        stmt = select(Schedule).where(Schedule.graph_id == graph_id)
        return list((await session.execute(stmt)).scalars())

    async def due(self, session: AsyncSession, *, now: datetime) -> list[Schedule]:
        """Active schedules whose next firing has come, locked so one process fires them."""
        stmt = (
            select(Schedule)
            .where(Schedule.status == ScheduleStatus.active.value, Schedule.next_fire_at <= now)
            .order_by(Schedule.next_fire_at)
            .with_for_update(skip_locked=True)
        )
        return list((await session.execute(stmt)).scalars())


class FiringQuerySet:
    async def add(self, session: AsyncSession, firing: ScheduleFiring) -> ScheduleFiring:
        session.add(firing)
        await session.flush()
        return firing

    async def get(self, session: AsyncSession, *, firing_id: str) -> ScheduleFiring | None:
        return await session.get(ScheduleFiring, firing_id)

    async def for_schedule(self, session: AsyncSession, *, schedule_id: str, limit: int) -> list[ScheduleFiring]:
        stmt = (
            select(ScheduleFiring)
            .where(ScheduleFiring.schedule_id == schedule_id)
            .order_by(ScheduleFiring.due_at.desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars())

    async def last_opened(self, session: AsyncSession, *, schedule_id: str) -> ScheduleFiring | None:
        stmt = (
            select(ScheduleFiring)
            .where(ScheduleFiring.schedule_id == schedule_id, ScheduleFiring.outcome == FiringOutcome.opened.value)
            .order_by(ScheduleFiring.fired_at.desc())
            .limit(1)
        )
        return (await session.execute(stmt)).scalars().first()

    async def queued(self, session: AsyncSession) -> list[ScheduleFiring]:
        stmt = (
            select(ScheduleFiring)
            .where(ScheduleFiring.outcome == FiringOutcome.queued.value)
            .order_by(ScheduleFiring.due_at)
            .with_for_update(skip_locked=True)
        )
        return list((await session.execute(stmt)).scalars())

    async def settled_undelivered(
        self, session: AsyncSession, *, terminal: frozenset[str], limit: int = 100
    ) -> list[tuple[ScheduleFiring, TaskRun]]:
        """Opened firings whose run has settled and that nobody has delivered yet."""
        stmt = (
            select(ScheduleFiring, TaskRun)
            .join(TaskRun, TaskRun.id == ScheduleFiring.run_id)
            .where(
                ScheduleFiring.outcome == FiringOutcome.opened.value,
                ScheduleFiring.delivered_at.is_(None),
                TaskRun.status.in_(terminal),
            )
            .order_by(ScheduleFiring.fired_at)
            .limit(limit)
            .with_for_update(of=ScheduleFiring, skip_locked=True)
        )
        return [(f, r) for f, r in (await session.execute(stmt)).all()]

    async def run(self, session: AsyncSession, *, run_id: str) -> TaskRun | None:
        return await session.get(TaskRun, run_id)
