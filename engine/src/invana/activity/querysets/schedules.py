"""Queries behind schedules and their firings (docs/for-developers/modules/operate/features/schedules.md)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import FiringOutcome, Schedule, ScheduleFiring, ScheduleStatus
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
