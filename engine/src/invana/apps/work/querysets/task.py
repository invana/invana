"""Queries against ``tasks``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import OPEN_TASK_STATUSES, Task, TaskStatus


class TaskQuerySet:
    async def get(self, session: AsyncSession, task_id: str) -> Task | None:
        return await session.get(Task, task_id)

    async def list_for_graph(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        project_id: str | None = None,
        assignee_id: str | None = None,
        status: list[str] | None = None,
        parent_id: str | None = None,
        include_sub_tasks: bool = True,
    ) -> list[Task]:
        stmt = select(Task).where(Task.graph_id == graph_id)
        if project_id is not None:
            stmt = stmt.where(Task.project_id == project_id)
        if assignee_id is not None:
            stmt = stmt.where(Task.assignee_id == assignee_id)
        if status:
            stmt = stmt.where(Task.status.in_(status))
        if parent_id is not None:
            stmt = stmt.where(Task.parent_id == parent_id)
        elif not include_sub_tasks:
            stmt = stmt.where(Task.parent_id.is_(None))
        return list((await session.execute(stmt.order_by(Task.created_at.desc()))).scalars().all())

    async def open_children(self, session: AsyncSession, *, parent_id: str) -> list[Task]:
        stmt = select(Task).where(
            Task.parent_id == parent_id,
            Task.status.in_([s.value for s in OPEN_TASK_STATUSES]),
        )
        return list((await session.execute(stmt)).scalars().all())

    async def open_for_agent(self, session: AsyncSession, *, graph_id: str, agent_id: str) -> list[Task]:
        """Tasks still open and assigned to this agent — what retirement blocks on."""
        stmt = select(Task).where(
            Task.graph_id == graph_id,
            Task.assignee_kind == "agent",
            Task.assignee_id == agent_id,
            Task.status.in_([s.value for s in OPEN_TASK_STATUSES]),
        )
        return list((await session.execute(stmt)).scalars().all())

    async def unfinished_in(self, session: AsyncSession, *, ids: list[str]) -> list[Task]:
        if not ids:
            return []
        stmt = select(Task).where(Task.id.in_(ids), Task.status != TaskStatus.done.value)
        return list((await session.execute(stmt)).scalars().all())

    async def titles(self, session: AsyncSession, ids: list[str]) -> list[str]:
        if not ids:
            return []
        rows = dict((await session.execute(select(Task.id, Task.title).where(Task.id.in_(ids)))).all())
        return [rows.get(i, i) for i in ids]

    async def count_by_project(self, session: AsyncSession, *, graph_id: str, open_only: bool = False) -> dict:
        stmt = select(Task.project_id, func.count(Task.id)).where(Task.graph_id == graph_id)
        if open_only:
            stmt = stmt.where(Task.status.in_([s.value for s in OPEN_TASK_STATUSES]))
        return dict((await session.execute(stmt.group_by(Task.project_id))).all())

    async def list_for_project(self, session: AsyncSession, *, graph_id: str, project_id: str | None) -> list[Task]:
        """Tasks in one project, or the graph's "No project" bucket when
        ``project_id`` is ``None``."""
        stmt = select(Task).where(Task.graph_id == graph_id, Task.project_id == project_id)
        return list((await session.execute(stmt)).scalars().all())

    async def by_ids(self, session: AsyncSession, ids: list[str]) -> list[Task]:
        if not ids:
            return []
        return list((await session.execute(select(Task).where(Task.id.in_(ids)))).scalars().all())

    async def add(self, session: AsyncSession, task: Task) -> Task:
        session.add(task)
        await session.flush()
        return task
