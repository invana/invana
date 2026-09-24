"""Bound: ``work_write`` — the entries that create work
(docs/for-developers/orchestration.md §0.6).

Making a child agent, opening a run under it, and filing a Task for a person
are the three acts that create work nobody has yet paid for — which is why they
share a bound the budget ceiling can see.

**This module reaches two apps** (`agents` · `work`). The span is named in
`tests/golden/test_catalogue.py`'s ``SPANS_ALLOWED`` and closes when
``delegate`` and ``create_task`` merge into one entry
(docs/for-developers/building-engine/the-runtime-package.md § 6.2).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.work.models import Task as WorkTask
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import current_trace_id, emit_event
from invana.runtime.catalogue.contract import (
    Out,
    RunVars,
    TaskContext,
    TaskFailure,
    _plural,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build


async def spawn_agent(ctx: TaskContext, v: RunVars) -> Out:
    """Create a helper agent under this agent's ceiling.

    Nothing about this step trusts the model: the name and the brief come from
    the plan, and every limit that matters — depth, fan-out, allow-list,
    skills, budget, LLM — is computed from the parent's row.
    """
    from invana.runtime.delegation import BoundExceeded, spawn

    if v.agent is None or v.run is None:
        raise TaskFailure(cls="defect", cause="internal", message="No agent is bound to this run.", short="no agent")
    args = ctx.step.args or {}
    try:
        child = await spawn(
            ctx.db,
            parent=v.agent,
            run=v.run,
            name=str(args.get("name") or "Helper"),
            instructions=str(args.get("instructions") or ""),
            requested={
                "allow": args.get("allow"),
                "skill_ids": args.get("skill_ids"),
                "budget": args.get("budget"),
            },
            lifetime=str(args.get("lifetime") or "ephemeral"),
        )
    except BoundExceeded as exc:
        raise TaskFailure(cls="blocked", cause="bound_exceeded", message=str(exc), short="not allowed") from exc
    v.spawned.append(child.id)
    depth = await _depth(ctx.db, child)
    await ctx.emit("agent.spawned", {"agent_id": child.id, "name": child.name, "lifetime": child.lifetime})
    return Out(
        detail=f'→ "{child.name}" ({child.lifetime} · depth {depth})',
        input={"requested_name": args.get("name")},
        output={"agent_id": child.id, "name": child.name, "depth": depth},
    )


async def delegate(ctx: TaskContext, v: RunVars) -> Out:
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
        trace_id=current_trace_id(),
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
        trace_id=current_trace_id(),
    )
    return Out(detail=f'sub-task "{child.title}"', output={"task_id": child.id})


async def _depth(db: AsyncSession, agent) -> int:
    from invana.runtime.delegation import depth_of

    return await depth_of(db, agent)


ENTRIES = build(
    Entry(
        key="spawn_agent",
        summary="Create a helper agent under this agent's ceiling.",
        bound=Bound.work_write,
        run=spawn_agent,
        args={
            "name": Arg(Type.str_),
            "instructions": Arg(Type.str_),
            "allow": Arg(Type.list_),
            "skill_ids": Arg(Type.list_),
            "budget": Arg(Type.obj),
            "lifetime": Arg(Type.str_, default="ephemeral"),
        },
        outputs={"agent_id": Type.str_, "name": Type.str_, "depth": Type.int_},
    ),
    Entry(
        key="delegate",
        summary="Open a run under a child agent and wait for it.",
        bound=Bound.work_write,
        run=delegate,
        args={"agent_id": Arg(Type.str_), "body": Arg(Type.str_)},
        outputs={"child_run_id": Type.str_, "status": Type.str_},
    ),
    Entry(
        key="create_task",
        summary="Write down work for a child agent or a person.",
        bound=Bound.work_write,
        run=create_task,
        args={"title": Arg(Type.str_), "body": Arg(Type.str_)},
        outputs={"task_id": Type.str_},
    ),
)
