"""The ``work.spawn_agent`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.core.work_write.shared import _depth
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


async def work_spawn_agent(ctx: TaskContext, v: RunVars) -> Out:
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
            step_id=ctx.step.id,
        )
    except BoundExceeded as exc:
        raise TaskFailure(
            cls="blocked", cause=exc.cause, message=str(exc), short="not allowed", evidence=exc.evidence
        ) from exc
    v.spawned.append(child.id)
    depth = await _depth(ctx.db, child)
    await ctx.emit("agent.spawned", {"agent_id": child.id, "name": child.name, "lifetime": child.lifetime})
    return Out(
        detail=f'→ "{child.name}" ({child.lifetime} · depth {depth})',
        input={"requested_name": args.get("name")},
        output={"agent_id": child.id, "name": child.name, "depth": depth},
    )


run = work_spawn_agent
