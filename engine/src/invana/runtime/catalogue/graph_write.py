"""Bound: ``graph_write`` — the entries that write to the bound graph database
(docs/for-developers/orchestration.md §0.6).

**This is the bound that matters most to ceiling**: an agent allowed `graph_read`
and not this one cannot change the graph, whatever plan it runs.

`write_graph` and `stitch` are the keys already stored on every load's nodes and
are not renamed (§6.4). `bulk_write` is the fast path, and it declares no
`requires` because nothing validated what it writes.

**The bodies are here, not one import away.** Loading owns no records of its own,
so there is no app to view and nothing for an entry to be thin against
(the-runtime-package.md § 4a). What stays in its own module is what is long
enough to read on its own: `records.py` for validating and writing records,
`stitching.py` for the rules between models.
"""

from __future__ import annotations

from pathlib import Path

from invana.graph.loaders import CSVLoader, LoaderConfig
from invana.runtime.catalogue import stitching
from invana.runtime.catalogue.contract import Out, RunVars, TaskContext, TaskFailure, Writes
from invana.runtime.catalogue.records import (
    LoadRefused,
    _solve_active_stitches,
    _stitch,
    _write,
    connector_for,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build


def _load(v: RunVars):
    if v.load is None:
        raise TaskFailure(
            cls="blocked",
            cause="not_a_load",
            message="This step belongs to a load, and this run is not one.",
            short="not a load",
        )
    return v.load


def _run_id(ctx: TaskContext) -> str:
    """The run whose name goes on every element this step writes (LD4 · §6.6).

    The **root**, not this node: provenance answers *which load wrote this*, and
    a load is the run, not the step inside it.
    """
    return ctx.step.parent_run_id or ctx.step.id


async def write_graph(ctx: TaskContext, v: RunVars) -> Out:
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


async def stitch(ctx: TaskContext, v: RunVars) -> Out:
    """Resolve what this load deferred, then run the Graph's standing rules (ST47).

    Two halves, and the second is why this is not just *finish the edges*: a
    stitch is a standing rule, so the records this load wrote are run through
    every **active** stitch in the Graph, scoped by this run's stamp.
    """
    load = _load(v)
    # Every model the edges land in (ST53): this load's own, fatal like
    # `write_graph`'s, and each stitch's two sides, which only skip that stitch.
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


async def apply_stitches(ctx: TaskContext, v: RunVars) -> Out:
    """Declare every rule `<root>/stitches.json` states, **staged** (ST21).

    Staged means the rows exist and nothing a question can reach has changed.
    Writing the edges is `commit_stitches`, and keeping them apart is why a
    declaration can be reviewed before it is true.
    """
    root = str((ctx.step.args or {}).get("root") or (v.load.root if v.load else ""))
    if not root:
        raise TaskFailure(
            cls="blocked", cause="no_source", message="No bundle folder to read rules from.", short="no source"
        )
    applied = await stitching.apply_bundle(ctx.db, graph_id=ctx.step.graph_id, root=Path(root))
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


async def commit_stitches(ctx: TaskContext, v: RunVars) -> Out:
    """Flip the staged set to active and run every stitch in it (ST44)."""
    await ctx.progress("writing stitched edges")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc
    writes = Writes(ctx, v)

    async def admit(link) -> bool:
        return all(
            [
                await writes.admit(link.source_version_id, fatal=False),
                await writes.admit(link.target_version_id, fatal=False),
            ]
        )

    committed = await stitching.commit_stitches(ctx.db, graph_id=ctx.step.graph_id, connector=connector, admit=admit)
    by_id = {link.id: link for link in committed.links}
    for done in [*committed.solved, *committed.loaded]:
        link = by_id.get(done.link_id)
        if link is not None and done.written:
            writes.wrote(link.source_version_id, edges=done.written)
            if link.target_version_id != link.source_version_id:
                writes.wrote(link.target_version_id, edges=done.written)
    await writes.close()
    return Out(
        detail=f"{committed.written} written · {committed.rejected} rejected",
        input={},
        output={
            "written": committed.written,
            "rejected": committed.rejected,
            # One row per stitch, so a drawer or a terminal can say what each one
            # wrote — a zero is a verdict, and a refusal names why (ST53).
            "links": [
                {
                    "link_id": done.link_id,
                    "rule": getattr(done, "rule", "") or "",
                    "edge_type": done.edge_type,
                    "written": done.written,
                    "skipped": done.skipped,
                }
                for done in [*committed.solved, *committed.loaded]
            ],
        },
    )


async def withdraw_stitch(ctx: TaskContext, v: RunVars) -> Out:
    """Withdraw the edges one active stitch wrote, then remove the rule (ST55).

    Both models are the write target, so a guardrail denying either one ends
    the run in *cannot answer* before an edge is deleted — unlike a commit,
    where a refused stitch is committed and skipped (ST53). Keeping the edges
    of a removed rule would leave edges naming a stitch nobody can see.
    """
    link_id = str((ctx.step.args or {}).get("link_id") or "")
    link = await stitching.link_service.get_link(ctx.db, ctx.step.graph_id, link_id) if link_id else None
    if link is None:
        raise TaskFailure(cls="blocked", cause="not_found", message="No such stitch in this Graph.", short="no stitch")
    await ctx.progress("withdrawing stitched edges")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc
    writes = Writes(ctx, v)
    withdrawn = await stitching.withdraw_stitch(
        ctx.db, graph_id=ctx.step.graph_id, link=link, connector=connector, admit=writes.admit
    )
    writes.wrote(link.source_version_id, edges=withdrawn)
    if link.target_version_id != link.source_version_id:
        writes.wrote(link.target_version_id, edges=withdrawn)
    await writes.close()
    return Out(
        detail=f"{withdrawn} edge(s) withdrawn",
        input={"link_id": link_id},
        output={"withdrawn": withdrawn},
    )


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


ENTRIES = build(
    Entry(
        key="write_graph",
        summary="Merge validated records into the graph, each stamped with its origin.",
        bound=Bound.graph_write,
        run=write_graph,
        outputs={"nodes": Type.int_, "edges": Type.int_, "written": Type.int_},
        requires=("validate_records",),
    ),
    Entry(
        key="stitch",
        summary="Resolve what a load deferred, then run the graph's standing stitches.",
        bound=Bound.graph_write,
        run=stitch,
        outputs={"resolved": Type.int_, "unresolved": Type.int_, "stitched": Type.int_},
        requires=("write_graph",),
    ),
    Entry(
        key="withdraw_stitch",
        summary="Delete the edges one active stitch wrote, then remove the rule.",
        bound=Bound.graph_write,
        run=withdraw_stitch,
        args={"link_id": Arg(Type.str_, required=True)},
        outputs={"withdrawn": Type.int_},
    ),
    Entry(
        key="bulk_write",
        summary="Write a CSV folder straight into the graph, validating nothing.",
        bound=Bound.graph_write,
        run=bulk_write,
        args={
            "root": Arg(Type.str_),
            "batch_size": Arg(Type.int_),
            "skip_on_error": Arg(Type.bool_),
            "keep_source_ids": Arg(Type.bool_),
        },
        outputs={"nodes": Type.int_, "edges": Type.int_, "failed": Type.int_},
        # **No `requires`.** Nothing validated this, and saying otherwise here
        # is the one thing that would make the fast path lie.
    ),
    Entry(
        key="apply_stitches",
        summary="Declare every stitch a bundle's stitches.json states, as staged.",
        bound=Bound.graph_write,
        run=apply_stitches,
        args={"root": Arg(Type.str_)},
        outputs={"declared": Type.int_, "already": Type.int_, "skipped": Type.int_, "passed": Type.bool_},
    ),
    Entry(
        key="commit_stitches",
        summary="Make the staged stitches active and write the edges they imply.",
        bound=Bound.graph_write,
        run=commit_stitches,
        outputs={"written": Type.int_, "rejected": Type.int_, "links": Type.list_},
        # **No `requires`.** The staged set is what it commits, and staging is
        # often a person's earlier act in the Stitches drawer rather than a step
        # in this plan — `stitch-commit@1` is this entry alone. A run with nothing
        # staged commits nothing; the openers refuse it before it starts.
    ),
)
