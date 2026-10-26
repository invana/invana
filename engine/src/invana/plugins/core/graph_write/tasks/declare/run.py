"""The ``graph.stitch.declare`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from pathlib import Path

from invana.plugins.core.ingest import stitching
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


async def graph_stitch_declare(ctx: TaskContext, v: RunVars) -> Out:
    """Declare every rule `<root>/stitches.json` states, **staged** (ST21).

    Staged means the rows exist and nothing a question can reach has changed.
    Writing the edges is `graph.stitch.commit`, and keeping them apart is why a
    declaration can be reviewed before it is true. Each declared stitch is
    recorded under the run's actor, so the inspector names who declared it.
    """
    root = str((ctx.step.args or {}).get("root") or (v.load.root if v.load else ""))
    if not root:
        raise TaskFailure(
            cls="blocked", cause="no_source", message="No bundle folder to read rules from.", short="no source"
        )
    applied = await stitching.apply_bundle(ctx.db, graph_id=ctx.step.graph_id, root=Path(root), actor_id=v.actor_id)
    return Out(
        detail=f"{applied.declared} declared · {applied.already} already · {applied.skipped} skipped",
        input={"root": root},
        output={
            "declared": applied.declared,
            "already": applied.already,
            "skipped": applied.skipped,
            "passed": applied.passed,
        },
    )


run = graph_stitch_declare
