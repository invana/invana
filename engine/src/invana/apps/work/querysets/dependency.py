"""Queries against ``task_dependencies``."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import Task, TaskDependency


class TaskDependencyQuerySet:
    async def depends_on_ids(self, session: AsyncSession, task_id: str) -> list[str]:
        stmt = select(TaskDependency.depends_on_id).where(TaskDependency.task_id == task_id)
        return list((await session.execute(stmt)).scalars().all())

    async def dependant_ids(self, session: AsyncSession, task_id: str) -> list[str]:
        stmt = select(TaskDependency.task_id).where(TaskDependency.depends_on_id == task_id)
        return list((await session.execute(stmt)).scalars().all())

    async def get_edge(self, session: AsyncSession, *, task_id: str, depends_on_id: str) -> TaskDependency | None:
        stmt = select(TaskDependency).where(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_id == depends_on_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def edges_into(self, session: AsyncSession, *, task_ids: list[str]) -> list[tuple[str, str]]:
        """``(depends_on_id, task_id)`` for every edge leaving these tasks."""
        if not task_ids:
            return []
        stmt = select(TaskDependency.depends_on_id, TaskDependency.task_id).where(TaskDependency.task_id.in_(task_ids))
        return [(a, b) for a, b in (await session.execute(stmt)).all()]

    async def all_edges_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[tuple[str, str]]:
        """Every edge in the Graph, not just one project's — a cross-project
        dependency is allowed, so a cycle can cross one too."""
        stmt = (
            select(TaskDependency.depends_on_id, TaskDependency.task_id)
            .join(Task, Task.id == TaskDependency.task_id)
            .where(Task.graph_id == graph_id)
        )
        return [(a, b) for a, b in (await session.execute(stmt)).all()]

    async def add(self, session: AsyncSession, row: TaskDependency) -> TaskDependency:
        session.add(row)
        await session.flush()
        return row

    async def delete(self, session: AsyncSession, row: TaskDependency) -> None:
        await session.delete(row)
        await session.flush()
