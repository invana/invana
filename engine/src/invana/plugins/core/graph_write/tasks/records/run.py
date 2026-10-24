"""The ``graph.write.records`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.core.graph_write.shared import _load, _run_id
from invana.plugins.core.ingest.records import LoadRefused, _write, connector_for
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import TaskFailure


async def graph_write_records(ctx: TaskContext, v: RunVars) -> Out:
    """MERGE what validated, every element stamped with its origin (LD4).

    Identity-keyed, which is what makes a re-run of the same file update rather
    than duplicate (C8).
    """
    load = _load(v)
    # The model this load pinned (LD8), checked before a record is written: a
    # guardrail that refuses it ends the run naming the rule (LD24 · GV35).
    writes = Writes(ctx, v)
    await writes.admit(load.version_id)
    await ctx.progress("writing records")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc

    load.counts, load.written = await _write(
        connector,
        model_id=load.model_id,
        run_id=_run_id(ctx),
        model_json=load.model_json,
        node_records=load.valid_nodes,
        edge_records=load.valid_edges,
    )
    writes.wrote(
        load.version_id,
        nodes=sum(load.counts["nodes"].values()),
        edges=sum(load.counts["edges"].values()),
    )
    await writes.close()
    return Out(
        detail=f"{load.written} of {load.total} written",
        input={"model_id": load.model_id},
        output={
            "nodes": sum(load.counts["nodes"].values()),
            "edges": sum(load.counts["edges"].values()),
            "written": load.written,
        },
    )


run = graph_write_records
