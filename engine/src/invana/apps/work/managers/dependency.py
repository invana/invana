"""Dependency edges between tasks (docs/for-developers/modules/work/spec.md).

An edge can cross projects, so a cycle can too — which is why the acyclicity
check runs over every edge in the Graph rather than one project's.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.work.managers.task import TaskManager, blocked_by_text
from invana.apps.work.models import Task, TaskDependency, TaskStatus
from invana.apps.work.plan import DependencyCycle, assert_acyclic
from invana.apps.work.querysets import TaskDependencyQuerySet, TaskQuerySet
from invana.apps.work.schemas import DependencyCreate
from invana.core.auth.models import User
from invana.core.errors import NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event


class DependencyManager:
    task_dependencies_qs = TaskDependencyQuerySet()
    tasks_qs = TaskQuerySet()
    tasks = TaskManager()

    async def add(
        self, session: AsyncSession, *, graph: Graph, task: Task, payload: DependencyCreate, actor: User
    ) -> TaskDependency:
        if payload.depends_on_id == task.id:
            raise ValidationError("A task cannot wait on itself.")
        other = await self.tasks.get(session, task_id=payload.depends_on_id, graph_id=graph.id)

        existing = await self.task_dependencies_qs.get_edge(session, task_id=task.id, depends_on_id=other.id)
        if existing is not None:
            return existing

        edges = await self.task_dependencies_qs.all_edges_for_graph(session, graph_id=graph.id)
        edges.append((other.id, task.id))
        try:
            assert_acyclic(edges)
        except DependencyCycle as cycle:
            titles = await self.tasks_qs.titles(session, cycle.loop)
            raise ValidationError(f"That would close a loop: {' → '.join(titles)}.") from cycle

        row = TaskDependency(
            task_id=task.id,
            depends_on_id=other.id,
            created_by_kind="user",
            created_by_id=actor.id,
        )
        await self.task_dependencies_qs.add(session, row)

        if other.status != TaskStatus.done.value and task.status in {
            TaskStatus.assigned.value,
            TaskStatus.open.value,
        }:
            task.status = TaskStatus.blocked.value
            task.blocked_reason = blocked_by_text([other])

        await emit_event(
            session,
            action=actions.TASK_DEPEND,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"depends_on_id": other.id, "depends_on_title": other.title},
            trace_id=current_trace_id(),
        )
        return row

    async def remove(self, session: AsyncSession, *, graph: Graph, task: Task, depends_on_id: str, actor: User) -> None:
        row = await self.task_dependencies_qs.get_edge(session, task_id=task.id, depends_on_id=depends_on_id)
        if row is None:
            raise NotFoundError("Dependency not found.")
        await self.task_dependencies_qs.delete(session, row)
        if task.status == TaskStatus.blocked.value:
            remaining = await self.tasks.open_dependencies(session, task)
            if not remaining:
                task.status = TaskStatus.assigned.value if task.assignee_id else TaskStatus.open.value
                task.blocked_reason = None
            else:
                task.blocked_reason = blocked_by_text(remaining)
        await emit_event(
            session,
            action=actions.TASK_UNDEPEND,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"depends_on_id": depends_on_id},
            trace_id=current_trace_id(),
        )
