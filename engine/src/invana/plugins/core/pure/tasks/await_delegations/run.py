"""The ``await_delegations`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from sqlalchemy import select

from invana.plugins.sdk.context import Out, RunVars, TaskContext, _plural
from invana.plugins.sdk.errors import TaskFailure
from invana.runtime.models import TaskRun


async def await_delegations(ctx: TaskContext, v: RunVars) -> Out:
    """Fan-in for a plan that delegated more than once before waiting.

    **This is control flow, and § 0.6 says control flow is never a catalogue
    entry.** It is declared here because ``COORDINATOR`` allows it by key
    today; the-runtime-package.md § 6.2 moves it into ``interpreter/``.
    """
    from invana.runtime.delegation import await_children

    ids = [str(i) for i in ((ctx.step.args or {}).get("run_ids") or [])]
    if not ids and v.run is not None:
        # The children of this run's nodes. A delegated run names the node that
        # delegated it, and that node names this run — so the edge is already
        # written, and a `child_run_id` column would be a third copy of it that
        # can disagree with the other two.
        nodes = select(TaskRun.id).where(TaskRun.parent_run_id == v.run.id)
        rows = (await ctx.db.execute(select(TaskRun.id).where(TaskRun.parent_run_id.in_(nodes)))).scalars().all()
        ids = [r for r in rows if r]
    if not ids:
        return Out(detail="nothing to wait for", output={"children": []})
    outcomes = await await_children(ctx.db, run_ids=ids)
    for outcome in outcomes:
        v.delegated.extend(outcome.emitted)
    failed = [o for o in outcomes if o.status != "succeeded"]
    if failed:
        raise TaskFailure(
            cls="blocked",
            cause="delegation_failed",
            message=f"{len(failed)} of {len(outcomes)} delegations did not finish.",
            short="child failed",
            evidence={"children": [o.run_id for o in failed]},
        )
    return Out(
        detail=f"{_plural(len(outcomes), 'child')} finished",
        output={"children": [{"run_id": o.run_id, "status": o.status} for o in outcomes]},
    )


run = await_delegations
