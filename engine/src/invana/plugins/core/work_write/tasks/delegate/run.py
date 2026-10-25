"""The ``work.delegate`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import asyncio

from invana.apps.agents.models import Agent
from invana.apps.work.models import Task as WorkTask
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _plural
from invana.plugins.sdk.errors import TaskFailure

#: How often a step held on an ask reads the decision back.
_ASK_POLL_S = 1.0
#: How long a held step waits past the ask's own deadline before giving up.
_ASK_SLACK_S = 120


async def work_delegate(ctx: TaskContext, v: RunVars) -> Out:
    """Open a run under another agent and wait for it.

    The parent step stays *running* while the child works, and the child's rows
    nest under it on the card — which is the whole reason a delegation is a
    child *run* rather than a hidden sub-call.

    Before the child opens, in this order: an agent already in the run's chain
    is refused as a loop; the caller's *May delegate to* says ``never`` (refused),
    ``always`` (runs) or ``ask`` — an approval routed to the target's owner,
    which this step waits on; then the child's **escrow** is moved out of this
    run's remaining budget, refused when it does not fit. Past the parent's
    ``max_live`` the child is opened and waits ``queued`` until a sibling ends.
    """
    from invana.runtime import delegation
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
    wanted = args.get("escrow")
    try:
        await delegation.refuse_loop(ctx.db, run=v.run, target=child_agent)
        if v.agent is not None:
            await _authorized(ctx, v, delegation, caller=v.agent, target=child_agent, body=body, wanted=wanted)
        escrow = await delegation.take_escrow(
            ctx.db, parent_run=v.run, child_agent=child_agent, wanted=int(wanted) if wanted else None
        )
    except delegation.BoundExceeded as exc:
        raise TaskFailure(
            cls="blocked", cause=exc.cause, message=str(exc), short="not allowed", evidence=exc.evidence
        ) from exc

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
    child_run.escrow_tokens = escrow
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
        details={
            "actor_name": v.agent.name if v.agent else None,
            "child_run_id": child_run.id,
            "escrow_tokens": escrow,
        },
    )
    await ctx.db.commit()
    await ctx.emit(
        "delegation.opened", {"child_run_id": child_run.id, "agent": child_agent.name, "escrow_tokens": escrow}
    )

    if not await delegation.wait_for_room(
        ctx.db, parent_run=v.run, child_run=child_run, timeout_s=delegation.DEFAULT_CHILD_TIMEOUT_S
    ):
        await delegation.end_waiting_children(ctx.db, [child_run.id])
        await ctx.db.commit()
        raise TaskFailure(
            cls="blocked",
            cause="time_limit",
            message=f"{child_agent.name} waited for a free slot and none came.",
            short="no slot",
            evidence={"child_run_id": child_run.id},
        )
    await ctx.progress(f"waits on {child_agent.name}")

    ctx.db.expire_all()
    runtime = ctx.runtime
    if runtime is not None:
        runtime.submit(child_run.id)
    outcomes = await delegation.await_children(ctx.db, run_ids=[child_run.id])
    outcome = outcomes[0]
    v.delegated.extend(outcome.emitted)
    if outcome.status != "succeeded":
        raise TaskFailure(
            cls="blocked",
            cause="time_limit" if outcome.status == "timed_out" else "delegation_failed",
            message=f"{child_agent.name} did not finish ({outcome.status}).",
            short=outcome.status,
            evidence={"child_run_id": child_run.id},
        )
    return Out(
        detail=f"{child_agent.name} · {_plural(len(outcome.emitted), 'emission')}",
        input={"agent_id": agent_id, "body": body[:200], "escrow": escrow},
        output={"child_run_id": child_run.id, "status": outcome.status},
    )


async def _authorized(ctx: TaskContext, v: RunVars, delegation, *, caller, target, body: str, wanted) -> None:
    """Pass when ``caller`` may hand work to ``target``; hold on an ask; raise when it may not.

    An ask is an approval routed to the target agent's owner. The step waits on
    it, and the rest of the run carries on; approved, the step continues —
    with *Allow always* written into the caller's list — and declined or expired,
    it fails and the child is never opened.
    """
    from invana.runtime import ledger_acts

    mode = delegation.may_delegate(caller, target)
    if mode == delegation.ALWAYS:
        return
    if mode == delegation.NEVER:
        raise delegation.BoundExceeded(
            f"{caller.name} may not delegate to {target.name}.", refused_by="policy", cause="policy"
        )
    runtime = ctx.runtime
    gate = getattr(type(runtime), "ask_gate", None) if runtime is not None else None
    if gate is None:
        raise TaskFailure(
            cls="blocked",
            cause="approvals_unavailable",
            message=f"Delegating to {target.name} needs its owner's approval, and this process has no approvals inbox.",
            short="no approvals inbox",
        )
    approval_id = (ctx.step.output or {}).get("approval_id")
    if not approval_id:
        actor = await ledger_acts.actor_of(ctx.db, v.run)
        root = await ledger_acts.root_of(ctx.db, v.run)
        approvers = await delegation.owner_of(ctx.db, target)
        approval_id = await gate.ask(
            ctx.db,
            kind="delegation",
            graph_id=v.graph.id,
            run_id=root.id,
            step_run_id=ctx.step.id,
            asked_by=actor.chain,
            wants=f"delegate to {target.name}",
            routed_reason="agent owner",
            approver_ids=approvers,
            payload={
                "from_agent_id": caller.id,
                "to_agent_id": target.id,
                "task": body[:2000],
                "escrow_tokens": int(wanted) if wanted else await delegation.remaining(ctx.db, v.run),
                # It sees the intersection of both worlds: the run's frozen lens, narrowed by its own.
                "sees": {"lens_id": v.run.lens_id, "within_run": v.run.id},
            },
        )
        ctx.step.output = {**(ctx.step.output or {}), "approval_id": approval_id}
        await ledger_acts.step_settled(
            ctx.db,
            run=v.run,
            step=ctx.step,
            touched=f"agent/{target.name}",
            verdict="approval",
            rule="agent owner",
        )
        ctx.step.detail = f"waits on approval to delegate to {target.name}"[:255]
        await ctx.db.commit()
        await ctx.emit("approval.requested", {"approval_id": approval_id, "step_id": ctx.step.id})
    await ctx.progress(f"waits on approval to delegate to {target.name}")

    loop = asyncio.get_running_loop()
    deadline = loop.time() + gate_deadline(gate) + _ASK_SLACK_S
    while True:
        status, who, scope = await gate.verdict(ctx.db, approval_id=approval_id)
        if status == "approved":
            if scope == "always":
                delegation.allow_always(caller, target)
            return
        if status in {"declined", "expired"} or loop.time() >= deadline:
            raise TaskFailure(
                cls="blocked",
                cause="delegation_declined",
                message=(
                    f"Declined by {who or 'its approver'}; {target.name} was not started."
                    if status == "declined"
                    else f"Nobody decided in time; {target.name} was not started."
                ),
                short="not approved",
                evidence={"approval_id": approval_id, "status": status, "refused_by": "policy"},
            )
        await asyncio.sleep(_ASK_POLL_S)


def gate_deadline(gate) -> int:
    """How long an ask from ``gate`` waits for its approver, in seconds."""
    from invana.runtime.interpreter.loop import ASK_DEADLINE_S

    return int(getattr(gate, "deadline_s", ASK_DEADLINE_S))


run = work_delegate
