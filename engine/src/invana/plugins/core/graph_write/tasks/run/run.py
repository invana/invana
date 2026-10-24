"""The ``graph.stitch.run`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from pathlib import Path

from invana.plugins.core.graph_write.shared import _load, _run_id
from invana.plugins.core.ingest.records import LoadRefused, _solve_active_stitches, _stitch, connector_for
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import TaskFailure


async def graph_stitch_run(ctx: TaskContext, v: RunVars) -> Out:
    """Resolve what this load deferred, then run the Graph's standing rules (ST47).

    Two halves, and the second is why this is not just *finish the edges*: a
    stitch is a standing rule, so the records this load wrote are run through
    every **active** stitch in the Graph, scoped by this run's stamp.
    """
    load = _load(v)
    # Every model the edges land in (ST53): this load's own, fatal like
    # `graph.write.records`'s, and each stitch's two sides, which only skip that stitch.
    writes = Writes(ctx, v)
    await writes.admit(load.version_id)

    async def admit(link) -> bool:
        return all(
            [
                await writes.admit(link.source_version_id, fatal=False),
                await writes.admit(link.target_version_id, fatal=False),
            ]
        )

    def on_written(link, n: int) -> None:
        writes.wrote(link.source_version_id, edges=n)
        if link.target_version_id != link.source_version_id:
            writes.wrote(link.target_version_id, edges=n)

    await ctx.progress("resolving edges")
    graph_id = ctx.step.graph_id
    run_id = _run_id(ctx)
    try:
        connector = await connector_for(ctx.db, graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc

    resolved, unresolved = await _stitch(
        connector, model_id=load.model_id, run_id=run_id, deferred=load.deferred, report=load.report
    )
    load.counts.setdefault("edges", {})
    load.counts["edges"] = {**load.counts["edges"], **resolved}

    stitched = await _solve_active_stitches(
        ctx.db,
        connector,
        graph_id=graph_id,
        model_id=load.model_id,
        run_id=run_id,
        root=Path(load.root),
        report=load.report,
        admit=admit,
        on_written=on_written,
    )
    writes.wrote(load.version_id, edges=sum(resolved.values()))
    await writes.close()
    for edge_type, n in stitched.items():
        load.counts["edges"][edge_type] = load.counts["edges"].get(edge_type, 0) + n

    return Out(
        detail=(f"{sum(resolved.values())} resolved · {unresolved} unresolved · {sum(stitched.values())} stitched"),
        input={"model_id": load.model_id},
        output={
            "resolved": sum(resolved.values()),
            "unresolved": unresolved,
            "stitched": sum(stitched.values()),
        },
    )


run = graph_stitch_run
