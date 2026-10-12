"""The ``bulk_write`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.graph.loaders import CSVLoader, LoaderConfig
from invana.plugins.core.ingest.records import LoadRefused, connector_for
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import TaskFailure


async def bulk_write(ctx: TaskContext, v: RunVars) -> Out:
    """Write a CSV folder straight through the connector, validating nothing (LD10).

    **It declares no `requires`, and that is the point.** `write_graph` requires
    `validate_records` because everything it writes was checked against a
    published version; this writes what the files say. Reusing `write_graph`
    here would have a bulk load claim a validation it never ran, so the fast
    path gets its own entry rather than a relaxed version of somebody else's.

    What it buys is speed, and what it costs is provenance: nothing written here
    carries `_inv_model_id` or `_inv_record_id`, so no answer grounded on it can
    be traced to a source record. The run says `bulk` for exactly that reason.
    """
    args = ctx.step.args or {}
    root = str(args.get("root") or "")
    if not root:
        raise TaskFailure(cls="blocked", cause="no_source", message="No folder to load.", short="no source")
    await ctx.progress(f"bulk loading {root}")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc

    config = LoaderConfig(
        batch_size=int(args.get("batch_size") or 500),
        skip_on_error=bool(args.get("skip_on_error")),
        keep_source_ids=bool(args.get("keep_source_ids", True)),
    )
    # No model, so the grounding version — the one address that covers every
    # label a bulk load can write (LD24 · GV35).
    writes = Writes(ctx, v)
    grounding = v.grounding.id if v.grounding is not None else None
    await writes.admit(grounding)
    loader = CSVLoader(connector=connector, config=config)
    async with connector:
        stats = await loader.load_directory(root)

    nodes, edges = stats.vertices_created, stats.edges_created
    failed = stats.vertices_failed + stats.edges_failed
    # A load that wrote nothing is a failure with its reasons, not a success
    # with a zero — the folder was named, so something was expected (LD10).
    if nodes == 0 and edges == 0:
        raise TaskFailure(
            cls="blocked",
            cause="nothing_written",
            message=(stats.errors or ["Nothing was written. Check the folder has nodes/ or relationships/."])[0],
            short="nothing written",
            raw="\n".join(stats.errors[:20]),
        )
    writes.wrote(grounding, nodes=nodes, edges=edges)
    await writes.close()
    return Out(
        detail=f"{nodes} node(s) / {edges} edge(s) · {failed} failed",
        input={"root": root},
        output={"nodes": nodes, "edges": edges, "failed": failed},
    )


run = bulk_write
