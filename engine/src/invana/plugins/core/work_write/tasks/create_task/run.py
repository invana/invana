"""The ``create_task`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.work.models import Task as WorkTask
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


async def create_task(ctx: TaskContext, v: RunVars) -> Out:
    """An agent writing down work for a child or for a human.

    Only inside a task-triggered run, and only as a **sub-task** of the
    current one — an agent that could create top-level tasks anywhere would be
    a way around the assignment seam.
    """
    if v.run is None or not v.run.todo_id:
        raise TaskFailure(
            cls="blocked",
            cause="no_task",
            message="An agent may only create a sub-task of a task it is working.",
            short="no parent task",
        )
    parent = await ctx.db.get(WorkTask, v.run.todo_id)
    if parent is None:
        raise TaskFailure(cls="blocked", cause="no_task", message="The parent task is gone.", short="no parent task")
    args = ctx.step.args or {}
    child = WorkTask(
        graph_id=v.graph.id,
        project_id=parent.project_id,
        parent_id=parent.id,
        title=str(args.get("title") or "Sub-task")[:255],
        body=str(args.get("body") or ""),
        created_by_kind="agent",
        created_by_id=v.agent.id if v.agent else None,
    )
    ctx.db.add(child)
    await ctx.db.flush()
    await emit_event(
        ctx.db,
        action=actions.TASK_CREATE,
        target_kind=actions.TARGET_TASK,
        target_id=child.id,
        graph_id=v.graph.id,
        project_id=child.project_id,
        task_id=child.id,
        run_id=v.run.id,
        actor_kind=ActorKind.agent,
        actor_id=v.agent.id if v.agent else None,
        on_behalf_of_user_id=v.run.on_behalf_of_user_id,
        details={"actor_name": v.agent.name if v.agent else None, "title": child.title, "parent_id": parent.id},
    )
    return Out(detail=f'sub-task "{child.title}"', output={"task_id": child.id})


run = create_task
