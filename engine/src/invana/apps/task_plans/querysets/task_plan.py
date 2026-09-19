"""Queries against ``task_plans`` and ``tasks``."""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.task_plans.models import Task, TaskPlan


class TaskPlanQuerySet:
    async def get(self, session: AsyncSession, plan_id: str) -> TaskPlan | None:
        return await session.get(TaskPlan, plan_id)

    async def list_for_graph(
        self, session: AsyncSession, *, graph_id: str, reusable_only: bool = True
    ) -> list[TaskPlan]:
        """The library.

        ``reusable_only`` is the default because a generated one-off plan
        belongs to its Todo and is read from the run that ran it — listing it
        would make the library a log ([LB6](docs/for-developers/modules/workflows/features/the-library.md)).
        """
        stmt = select(TaskPlan).where(TaskPlan.graph_id == graph_id)
        if reusable_only:
            stmt = stmt.where(TaskPlan.reusable.is_(True))
        stmt = stmt.order_by(TaskPlan.key, TaskPlan.version.desc())
        return list((await session.execute(stmt)).scalars().all())

    async def find_by_key(
        self, session: AsyncSession, *, graph_id: str, key: str, version: int | None
    ) -> TaskPlan | None:
        """The named version, or the newest when ``version`` is ``None``."""
        stmt = select(TaskPlan).where(TaskPlan.graph_id == graph_id, TaskPlan.key == key)
        if version is not None:
            stmt = stmt.where(TaskPlan.version == version)
        return (await session.execute(stmt.order_by(TaskPlan.version.desc()))).scalars().first()

    async def key_versions(self, session: AsyncSession, *, graph_id: str) -> set[tuple[str, int]]:
        stmt = select(TaskPlan.key, TaskPlan.version).where(TaskPlan.graph_id == graph_id)
        return {(key, version) for key, version in (await session.execute(stmt)).all() if key}

    async def plans_without_nodes(self, session: AsyncSession, *, graph_id: str) -> dict[tuple[str, int], str]:
        """``(key, version) → plan_id`` for library rows that have no nodes.

        A plan **is** its rows, so a row with none is not a plan anybody can
        read or run. Migration ``000000000038`` carries the library across and
        drops ``spec``, trusting a seeded entry to rebuild itself from the
        registry — which it can only do if the rebuild can tell *exists* from
        *exists and is populated*. Identity alone cannot, because the carried
        row keeps its key and version.
        """
        stmt = (
            select(TaskPlan.key, TaskPlan.version, TaskPlan.id)
            .outerjoin(Task, Task.task_plan_id == TaskPlan.id)
            .where(TaskPlan.graph_id == graph_id)
            .group_by(TaskPlan.key, TaskPlan.version, TaskPlan.id)
            .having(func.count(Task.id) == 0)
        )
        return {(key, version): plan_id for key, version, plan_id in (await session.execute(stmt)).all() if key}

    async def latest_version(self, session: AsyncSession, *, graph_id: str, key: str) -> int | None:
        stmt = (
            select(TaskPlan.version)
            .where(TaskPlan.graph_id == graph_id, TaskPlan.key == key)
            .order_by(TaskPlan.version.desc())
            .limit(1)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, plan: TaskPlan) -> TaskPlan:
        session.add(plan)
        await session.flush()
        return plan

    # ── The nodes ──────────────────────────────────────────────────────────
    async def tasks_for(self, session: AsyncSession, *, plan_id: str) -> list[Task]:
        stmt = select(Task).where(Task.task_plan_id == plan_id).order_by(Task.ordinal, Task.key)
        return list((await session.execute(stmt)).scalars().all())

    async def tasks_for_plans(self, session: AsyncSession, *, plan_ids: list[str]) -> dict[str, list[Task]]:
        """Every plan's nodes in one query — the list view needs a count per row."""
        if not plan_ids:
            return {}
        stmt = select(Task).where(Task.task_plan_id.in_(plan_ids)).order_by(Task.ordinal, Task.key)
        out: dict[str, list[Task]] = {}
        for task in (await session.execute(stmt)).scalars().all():
            out.setdefault(task.task_plan_id, []).append(task)
        return out

    async def add_tasks(self, session: AsyncSession, tasks: list[Task]) -> list[Task]:
        session.add_all(tasks)
        await session.flush()
        return tasks

    async def clear_tasks(self, session: AsyncSession, *, plan_id: str) -> None:
        await session.execute(delete(Task).where(Task.task_plan_id == plan_id))
