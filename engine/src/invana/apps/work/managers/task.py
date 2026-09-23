"""Task rules — the status machine, assignment, and the trace.

The two rules that shape everything here:

1. **An agent never marks its own task done.** It posts a result → ``review``;
   a ``user`` principal accepts. That is the governance seam, and the capture
   signal the learning loop reads (docs/for-developers/modules/work/spec.md,
   docs/for-developers/modules/agents/spec.md).
2. **Assignment opens exactly one run.** A Task is worked *through*
   runs, never run — so there is no second execution path to keep in step
   with the session one (R1).
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph
from invana.apps.graphs.querysets import GraphMemberQuerySet
from invana.apps.work.managers.project import ProjectManager
from invana.apps.work.models import (
    MAX_TASK_DEPTH,
    Project,
    Task,
    TaskStatus,
)
from invana.apps.work.querysets import ProjectQuerySet, TaskDependencyQuerySet, TaskQuerySet
from invana.apps.work.schemas import TaskCreate, TaskResultRequest, TaskUpdate
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind, Event
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event


def _utcnow() -> datetime:
    return datetime.now(UTC)


def blocked_by_text(blockers: list[Task]) -> str:
    names = ", ".join(t.title for t in blockers[:3])
    extra = f" +{len(blockers) - 3} more" if len(blockers) > 3 else ""
    return f"waits on {names}{extra}"[:255]


class TaskManager:
    tasks_qs = TaskQuerySet()
    dependencies_qs = TaskDependencyQuerySet()
    projects_qs = ProjectQuerySet()
    members_qs = GraphMemberQuerySet()
    projects = ProjectManager()

    # ── Reads ────────────────────────────────────────────────────────────────

    async def list_for_graph(self, session: AsyncSession, **kwargs) -> list[Task]:
        return await self.tasks_qs.list_for_graph(session, **kwargs)

    async def get(self, session: AsyncSession, *, task_id: str, graph_id: str) -> Task:
        task = await self.tasks_qs.get(session, task_id)
        if task is None or task.graph_id != graph_id:
            raise NotFoundError("Task not found.")
        return task

    async def depends_on_ids(self, session: AsyncSession, task_id: str) -> list[str]:
        return await self.dependencies_qs.depends_on_ids(session, task_id)

    async def dependant_ids(self, session: AsyncSession, task_id: str) -> list[str]:
        return await self.dependencies_qs.dependant_ids(session, task_id)

    # ── Writes ───────────────────────────────────────────────────────────────

    async def create(self, session: AsyncSession, *, graph: Graph, payload: TaskCreate, actor: User) -> Task:
        project = None
        if payload.project_key:
            project = await self.projects.get_by_key(session, key=payload.project_key, graph_id=graph.id)
            self.projects.require_writable(project)

        if payload.parent_id:
            parent = await self.get(session, task_id=payload.parent_id, graph_id=graph.id)
            if await self._depth(session, parent) >= MAX_TASK_DEPTH - 1:
                raise ValidationError(f"Sub-tasks go {MAX_TASK_DEPTH} deep; past that it is a project.")
            # A sub-task inherits its parent's project unless told otherwise, so
            # a child never silently falls out of the folder its parent is in.
            if project is None and parent.project_id:
                project = await self.projects_qs.get(session, parent.project_id)

        task = Task(
            graph_id=graph.id,
            project_id=project.id if project else None,
            parent_id=payload.parent_id,
            title=payload.title,
            body=payload.body,
            acceptance=payload.acceptance,
            due_at=payload.due_at,
            created_by_kind="user",
            created_by_id=actor.id,
        )
        await self.tasks_qs.add(session, task)
        create_event = await emit_event(
            session,
            action=actions.TASK_CREATE,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"title": task.title},
            trace_id=current_trace_id(),
        )
        if payload.assignee_kind and payload.assignee_id:
            await self.assign(
                session,
                graph=graph,
                task=task,
                assignee_kind=payload.assignee_kind,
                assignee_id=payload.assignee_id,
                actor=actor,
                parent_event_id=create_event.id,
            )
        return task

    async def update(
        self, session: AsyncSession, *, graph: Graph, task: Task, payload: TaskUpdate, actor: User
    ) -> Task:
        await self._require_writable(session, task)

        if payload.project_key is not None:
            project = await self.projects.get_by_key(session, key=payload.project_key, graph_id=graph.id)
            task.project_id = project.id

        fields = ["title", "body", "acceptance", "due_at"]
        before = {f: getattr(task, f) for f in fields}
        for field in fields:
            value = getattr(payload, field)
            if value is not None:
                setattr(task, field, value)
        changed = diff_changed_fields(before, {f: getattr(task, f) for f in fields}, fields=fields)
        if changed:
            await emit_event(
                session,
                action=actions.TASK_UPDATE,
                target_kind=actions.TARGET_TASK,
                target_id=task.id,
                graph_id=graph.id,
                project_id=task.project_id,
                task_id=task.id,
                actor_id=actor.id,
                details={"changed": changed},
                trace_id=current_trace_id(),
            )

        if payload.assignee_kind == "none":
            await self.unassign(session, graph=graph, task=task, actor=actor)
        elif payload.assignee_kind and payload.assignee_id:
            await self.assign(
                session,
                graph=graph,
                task=task,
                assignee_kind=payload.assignee_kind,
                assignee_id=payload.assignee_id,
                actor=actor,
            )
        return task

    async def assign(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        task: Task,
        assignee_kind: str,
        assignee_id: str,
        actor: User,
        parent_event_id: str | None = None,
    ) -> Task:
        """Hand the task to a person or an agent.

        For an agent this is the whole trigger: the assignment opens exactly one
        run, and the run is what moves the task to ``in_progress``. A
        *blocked* task is the one exception — the agent does nothing and holds no
        budget until the last dependency closes.
        """
        await self._require_writable(session, task)
        agent: Agent | None = None
        if assignee_kind == "agent":
            agent = await AgentManager().get_or_404(session, agent_id=assignee_id, graph_id=graph.id)
            if not agent.effective_policy.get("can_be_assigned", True):
                raise ConflictError(f"'{agent.name}' does not take assignments.")
        else:
            member = await self.members_qs.get(session, graph_id=graph.id, user_id=assignee_id)
            if member is None:
                raise NotFoundError("That person is not a member of this graph.")

        task.assignee_kind = assignee_kind
        task.assignee_id = assignee_id
        blockers = await self.open_dependencies(session, task)
        task.status = TaskStatus.blocked.value if blockers else TaskStatus.assigned.value
        task.blocked_reason = blocked_by_text(blockers) if blockers else None

        assign_event = await emit_event(
            session,
            action=actions.TASK_ASSIGN,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            parent_event_id=parent_event_id,
            details={
                "assignee_kind": assignee_kind,
                "assignee_id": assignee_id,
                "assignee_name": agent.name if agent else None,
            },
            trace_id=current_trace_id(),
        )

        if agent is not None and not blockers:
            await self.start_agent_work(
                session, graph=graph, task=task, agent=agent, on_behalf_of=actor.id, cause=assign_event
            )
        return task

    async def unassign(self, session: AsyncSession, *, graph: Graph, task: Task, actor: User) -> Task:
        await self._require_writable(session, task)
        previous = task.assignee_id
        task.assignee_kind = None
        task.assignee_id = None
        task.status = TaskStatus.open.value
        task.blocked_reason = None
        await emit_event(
            session,
            action=actions.TASK_UNASSIGN,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"was": previous},
            trace_id=current_trace_id(),
        )
        return task

    async def start_agent_work(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        task: Task,
        agent: Agent,
        on_behalf_of: str,
        cause: Event | None = None,
    ) -> None:
        """Open the one run an assignment opens.

        Deferred import: the runtime reaches back into tasks to settle a result,
        and the cycle is real rather than accidental — the two halves of "a task
        is worked through as runs".
        """
        from invana.runtime.services import open_todo_run

        if not agent.is_available:
            task.status = TaskStatus.blocked.value
            task.blocked_reason = f"'{agent.name}' is {agent.status}"
            return

        run = await open_todo_run(session, graph=graph, task=task, agent=agent, on_behalf_of_user_id=on_behalf_of)
        task.status = TaskStatus.in_progress.value
        task.blocked_reason = None
        await emit_event(
            session,
            action=actions.TASK_START,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            run_id=run.id,
            actor_kind=ActorKind.agent,
            actor_id=agent.id,
            on_behalf_of_user_id=on_behalf_of,
            parent_event_id=cause.id if cause else None,
            details={"actor_name": agent.name, "run_id": run.id},
            trace_id=current_trace_id(),
        )

    async def post_result(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        task: Task,
        payload: TaskResultRequest,
        actor_kind: ActorKind,
        actor_id: str | None,
        actor_name: str | None = None,
        on_behalf_of_user_id: str | None = None,
        run_id: str | None = None,
    ) -> Task:
        """The assignee's final statement → ``review``.

        A parent task cannot post a result while a sub-task is open: "done"
        would be a claim about work that has not happened.
        """
        open_children = await self.tasks_qs.open_children(session, parent_id=task.id)
        if open_children:
            raise ConflictError(f"{len(open_children)} sub-task(s) are still open.")
        task.result = {
            "summary": payload.summary,
            "run_ids": payload.run_ids,
            "emitted": payload.emitted,
        }
        task.status = TaskStatus.review.value
        await emit_event(
            session,
            action=actions.TASK_RESULT,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            run_id=run_id,
            actor_kind=actor_kind,
            actor_id=actor_id,
            on_behalf_of_user_id=on_behalf_of_user_id,
            details={"summary": payload.summary[:500], "actor_name": actor_name},
            trace_id=current_trace_id(),
        )
        return task

    async def accept(self, session: AsyncSession, *, graph: Graph, task: Task, actor: User) -> Task:
        """Only a ``user`` principal reaches this method.

        That is not a check inside it — it is the shape of the call site: the
        view depends on ``get_current_user``, and no agent-side code path calls
        it. An agent accepting its own work would make ``review`` decorative.
        """
        if task.status != TaskStatus.review.value:
            raise ConflictError(f"Only a task in review can be accepted; this one is {task.status}.")
        task.status = TaskStatus.done.value
        task.closed_at = _utcnow()
        accept_event = await emit_event(
            session,
            action=actions.TASK_ACCEPT,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"title": task.title},
            trace_id=current_trace_id(),
        )
        await self._lifecycle().retire_ephemeral_for_task(session, task_id=task.id, graph_id=graph.id)
        await self.unblock_dependants(session, graph=graph, task=task, cause=accept_event)
        return task

    async def reject(self, session: AsyncSession, *, graph: Graph, task: Task, note: str, actor: User) -> Task:
        """A rejection is not a status — it is **a new Thought on the same
        task**, so the timeline shows every round rather than the last one."""
        if task.status != TaskStatus.review.value:
            raise ConflictError(f"Only a task in review can be rejected; this one is {task.status}.")
        reject_event = await emit_event(
            session,
            action=actions.TASK_REJECT,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"note": note[:1000]},
            trace_id=current_trace_id(),
        )
        task.status = TaskStatus.assigned.value
        task.result = None
        if task.assignee_kind == "agent" and task.assignee_id:
            agent = await session.get(Agent, task.assignee_id)
            if agent is not None:
                from invana.runtime.services import open_todo_run

                run = await open_todo_run(
                    session,
                    graph=graph,
                    task=task,
                    agent=agent,
                    on_behalf_of_user_id=actor.id,
                    body=f"{task.body}\n\nRework requested: {note}".strip(),
                )
                task.status = TaskStatus.in_progress.value
                await emit_event(
                    session,
                    action=actions.TASK_START,
                    target_kind=actions.TARGET_TASK,
                    target_id=task.id,
                    graph_id=graph.id,
                    project_id=task.project_id,
                    task_id=task.id,
                    run_id=run.id,
                    actor_kind=ActorKind.agent,
                    actor_id=agent.id,
                    on_behalf_of_user_id=actor.id,
                    parent_event_id=reject_event.id,
                    details={"actor_name": agent.name, "rework": True},
                    trace_id=current_trace_id(),
                )
        return task

    async def cancel(self, session: AsyncSession, *, graph: Graph, task: Task, actor: User) -> Task:
        task.status = TaskStatus.cancelled.value
        task.closed_at = _utcnow()
        await emit_event(
            session,
            action=actions.TASK_CANCEL,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=graph.id,
            project_id=task.project_id,
            task_id=task.id,
            actor_id=actor.id,
            details={"title": task.title},
            trace_id=current_trace_id(),
        )
        await self._lifecycle().retire_ephemeral_for_task(session, task_id=task.id, graph_id=graph.id)
        return task

    # ── Dependency ripples ───────────────────────────────────────────────────

    async def unblock_dependants(self, session: AsyncSession, *, graph: Graph, task: Task, cause: Event | None) -> None:
        """The completing task releases whatever was waiting on it.

        The unblock is recorded as a ``task.update`` whose ``parent_event_id``
        points at the acceptance — so the trace answers *why* a task started,
        not just that it did. For an agent assignee the same trigger a manual
        assignment uses fires here, which is why the two read identically.
        """
        for dependant_id in await self.dependencies_qs.dependant_ids(session, task.id):
            dependant = await self.tasks_qs.get(session, dependant_id)
            if dependant is None or dependant.status != TaskStatus.blocked.value:
                continue
            remaining = await self.open_dependencies(session, dependant)
            if remaining:
                dependant.blocked_reason = blocked_by_text(remaining)
                continue

            dependant.status = TaskStatus.assigned.value if dependant.assignee_id else TaskStatus.open.value
            dependant.blocked_reason = None
            await emit_event(
                session,
                action=actions.TASK_UPDATE,
                target_kind=actions.TARGET_TASK,
                target_id=dependant.id,
                graph_id=graph.id,
                project_id=dependant.project_id,
                task_id=dependant.id,
                actor_kind=ActorKind.system,
                parent_event_id=cause.id if cause else None,
                details={
                    "status": {"before": TaskStatus.blocked.value, "after": dependant.status},
                    "cause": f"task.done {task.id}",
                },
                trace_id=current_trace_id(),
            )
            if dependant.assignee_kind == "agent" and dependant.assignee_id:
                agent = await session.get(Agent, dependant.assignee_id)
                on_behalf = cause.actor_id if cause and cause.actor_kind == ActorKind.user else None
                if agent is not None and on_behalf:
                    await self.start_agent_work(
                        session, graph=graph, task=dependant, agent=agent, on_behalf_of=on_behalf, cause=cause
                    )

    async def reopen_dependants(self, session: AsyncSession, *, task: Task) -> None:
        """A rejected dependency pushes back only the dependants that have **not
        started**. Ones already running keep going and show *dependency
        re-opened* — stopping live work because an upstream review turned would
        waste more than it protects."""
        for dependant_id in await self.dependencies_qs.dependant_ids(session, task.id):
            dependant = await self.tasks_qs.get(session, dependant_id)
            if dependant is None:
                continue
            if dependant.status in {TaskStatus.open.value, TaskStatus.assigned.value}:
                dependant.status = TaskStatus.blocked.value
                dependant.blocked_reason = blocked_by_text([task])
            elif dependant.status == TaskStatus.in_progress.value:
                dependant.blocked_reason = f"dependency re-opened: {task.title}"

    async def open_dependencies(self, session: AsyncSession, task: Task) -> list[Task]:
        ids = await self.dependencies_qs.depends_on_ids(session, task.id)
        return await self.tasks_qs.unfinished_in(session, ids=ids)

    # ── Helpers ──────────────────────────────────────────────────────────────

    async def _require_writable(self, session: AsyncSession, task: Task) -> None:
        if task.project_id:
            project: Project | None = await self.projects_qs.get(session, task.project_id)
            self.projects.require_writable(project)

    async def _depth(self, session: AsyncSession, task: Task) -> int:
        depth = 0
        node = task
        while node.parent_id and depth < MAX_TASK_DEPTH + 1:
            parent = await self.tasks_qs.get(session, node.parent_id)
            if parent is None:
                break
            node = parent
            depth += 1
        return depth

    def _lifecycle(self):
        """Deferred: the runtime is band 3 and an app may not import it at module
        scope. Retiring a task's ephemeral agents reads `runs`, so it lives
        there (migration-plan §18.1.1 S1)."""
        from invana.runtime.managers import AgentLifecycleManager

        return AgentLifecycleManager()
