"""The ``work.delegate`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.agents.models import Agent
from invana.apps.work.models import Task as WorkTask
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _plural
from invana.plugins.sdk.errors import TaskFailure


async def work_delegate(ctx: TaskContext, v: RunVars) -> Out:
    """Open a run under a child agent and wait for it.

    The parent step stays *running* while the child works, and the child's rows
    nest under it on the card — which is the whole reason a delegation is a
    child *run* rather than a hidden sub-call.
    """
    from invana.runtime.delegation import await_children
    from invana.runtime.services import open_todo_run

    if v.run is None:
        raise TaskFailure(cls="defect", cause="internal", message="No run is bound.", short="internal")
    args = ctx.step.args or {}
    agent_id = str(args.get("agent_id") or "") or (v.spawned[-1] if v.spawned else "")
    if not agent_id:
        raise TaskFailure(
            cls="blocked", cause="no_child", message="Nothing to delegate to — no agent was spawned.", short="no child"
        )
    child_agent = await ctx.db.get(Agent, agent_id)
    if child_agent is None or child_agent.graph_id != v.graph.id:
        raise TaskFailure(cls="blocked", cause="no_child", message="That agent is not in this graph.", short="no child")

    body = str(args.get("body") or v.prompt)
    task = await ctx.db.get(WorkTask, v.run.todo_id) if v.run.todo_id else None
    if task is None:
        raise TaskFailure(
            cls="blocked",
            cause="no_task",
            message="Delegation needs a task to hang the child's work off.",
            short="no task",
        )
    child_run = await open_todo_run(
        ctx.db,
        graph=v.graph,
        task=task,
        agent=child_agent,
        on_behalf_of_user_id=v.run.on_behalf_of_user_id or v.actor_id,
        body=body,
        # The node that delegated is the child's parent — one edge, not three.
        parent_run_id=ctx.step.id,
    )
    await emit_event(
        ctx.db,
        action=actions.THINKING_DELEGATE,
        target_kind=actions.TARGET_THINKING,
        target_id=child_run.id,
        graph_id=v.graph.id,
        task_id=v.run.todo_id,
        run_id=v.run.id,
        node_run_id=ctx.step.id,
        actor_kind=ActorKind.agent,
        actor_id=v.agent.id if v.agent else None,
        on_behalf_of_user_id=v.run.on_behalf_of_user_id,
        details={"actor_name": v.agent.name if v.agent else None, "child_run_id": child_run.id},
    )
    await ctx.db.commit()
    await ctx.emit("delegation.opened", {"child_run_id": child_run.id, "agent": child_agent.name})
    await ctx.progress(f"waits on {child_agent.name}")

    ctx.db.expire_all()
    runtime = ctx.runtime
    if runtime is not None:
        runtime.submit(child_run.id)
    outcomes = await await_children(ctx.db, run_ids=[child_run.id])
    outcome = outcomes[0]
    v.delegated.extend(outcome.emitted)
    if outcome.status != "succeeded":
        raise TaskFailure(
            cls="blocked",
            cause="delegation_failed",
            message=f"{child_agent.name} did not finish ({outcome.status}).",
            short=outcome.status,
            evidence={"child_run_id": child_run.id},
        )
    return Out(
        detail=f"{child_agent.name} · {_plural(len(outcome.emitted), 'emission')}",
        input={"agent_id": agent_id, "body": body[:200]},
        output={"child_run_id": child_run.id, "status": outcome.status},
    )


run = work_delegate
