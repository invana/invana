"""The Task read-model — a task plus everything linked to it.

Band 4 rather than `apps/work`, because it joins the task with its **runs**
(`runtime`, band 3) as well as its project, assignee and dependencies
(`apps/*`, band 2). An app may not import the runtime; this band may import
both (migration-plan §2, §18.1.1 S1).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.work.managers import TaskManager
from invana.apps.work.models import Task
from invana.apps.work.querysets import ProjectQuerySet
from invana.apps.work.schemas import TaskRead
from invana.core.auth.models import User
from invana.runtime.models import TaskRun


class TaskReadManager:
    tasks = TaskManager()
    projects_qs = ProjectQuerySet()

    async def compose(self, session: AsyncSession, task: Task) -> TaskRead:
        read = TaskRead.model_validate(task)
        if task.project_id:
            project = await self.projects_qs.get(session, task.project_id)
            read.project_key = project.key if project else None
        if task.assignee_id:
            if task.assignee_kind == "agent":
                agent = await session.get(Agent, task.assignee_id)
                read.assignee_name = agent.name if agent else None
            else:
                user = await session.get(User, task.assignee_id)
                read.assignee_name = user.username if user else None
        read.depends_on = await self.tasks.depends_on_ids(session, task.id)
        read.blocks = await self.tasks.dependant_ids(session, task.id)
        read.sub_task_ids = await self._sub_task_ids(session, task.id)
        read.run_ids = await self._run_ids(session, task.id)
        return read

    async def _sub_task_ids(self, session: AsyncSession, task_id: str) -> list[str]:
        stmt = select(Task.id).where(Task.parent_id == task_id)
        return list((await session.execute(stmt)).scalars().all())

    async def _run_ids(self, session: AsyncSession, task_id: str) -> list[str]:
        stmt = select(TaskRun.id).where(TaskRun.todo_id == task_id).order_by(TaskRun.queued_at)
        return list((await session.execute(stmt)).scalars().all())
