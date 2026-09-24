"""Bound: ``graph_read`` — the entries that read the bound graph database
(docs/for-developers/orchestration.md §0.6).

Five entries: a query somebody wrote, a neighbourhood the canvas asked for,
the types a world holds, whether a canvas's elements are still in view, and
what a stitch rule would resolve.
Dialect is a connector concern, not a catalogue one: Gremlin does not get a
second key.

This is where a run engages the ``graph_data`` layer, so it is where the lens
bites — through the contract's ``open_graph`` / ``close_graph``, which own what
a crossing *is* so that an entry stays a view over one app. The version is
checked before the query is sent, the narrowing is handed to the connector as a
``QueryLens``, and one touch is recorded carrying both digests. **Nothing is
enforced by filtering afterwards**
([govern § 2](docs/for-developers/modules/govern/spec.md)).
"""

from __future__ import annotations

import time

from fastapi import HTTPException

from invana.apps.graphs.query_service import (
    QueryExecutionError,
    _resolve_connector,
    _resolve_query_language,
    execute_query,
)
from invana.apps.graphs.schemas import QueryResponse
from invana.graph.connectors.base.exceptions import ConnectorError, LensViolationError
from invana.graph.types.filters import FilterGroup
from invana.graph.types.sort import SortSpec
from invana.runtime.catalogue import stitching
from invana.runtime.catalogue.contract import (
    CannotAnswer,
    Out,
    RunVars,
    TaskContext,
    TaskFailure,
    _query_failure,
    _sha,
    close_graph,
    http_failure,
    open_graph,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build


def _rewritten(result) -> bool:
    """Did the lens change the query between generation and execution?"""
    return result.composed is not None and result.composed.rewritten


def query_record(result, *, digests: dict[str, str], timeout_s, parameters: bool) -> dict:
    """What the step records about the query it sent.

    Both digests always, and **both texts** only when the lens rewrote the
    query. A digest proves a difference without showing one, and *1,283*
    printed beside the generated query is a citation that returns 4,902 if a
    reader runs it — so the query that produced the number is recorded beside
    the one that was asked for ([GV34](docs/for-developers/modules/govern/spec.md)).

    Both, because the step is what the dashboard reads and the generated query
    is not otherwise on it: an ask run's `args` carry `read_only` and nothing
    else, the question living on the message. A band that could show only the
    rewritten half would leave a reader comparing it against something they
    have to go and find.

    On the step, never on the touch: `run_touches` is an index into the trace,
    and a copy of the text there would make it a second record of it
    ([GV20](docs/for-developers/modules/govern/spec.md)). Where the digests are
    equal nothing is recorded, because the resolved request already **is** what
    ran and a second copy of it would say nothing.
    """
    record: dict = {"query": digests}
    if _rewritten(result):
        record["generated_query"] = result.composed.generated
        record["executed_query"] = result.composed.executed
    record["timeout_s"] = timeout_s
    record["parameters"] = parameters
    return record


async def execute_graph_query(ctx: TaskContext, v: RunVars) -> Out:
    """Run the query against the bound connection; the result rides the stream.

    ``read_only`` arrives pinned by the envelope, not chosen by the plan — the
    validator rejects any plan that tries to unset it. The textual check in
    *Validate* and the connection's own guard are the deeper backstops.
    """
    bound = str((ctx.step.args or {}).get("query") or "")
    if bound:
        v.query = bound
    assert v.query is not None
    crossing = await open_graph(ctx, v)
    await ctx.progress("waiting for the graph")
    try:
        result = await execute_query(
            ctx.db,
            graph=v.graph,
            manager=ctx.manager,
            query=v.query,
            parameters=v.parameters,
            actor_id=v.actor_id,
            session_id=v.sess.id,
            timeout_s=v.timeout_s,
            lens=crossing.lens,
        )
    except HTTPException as exc:
        raise http_failure(exc) from exc
    except QueryExecutionError as exc:
        raise _query_failure(exc, query=v.query, mode=v.mode) from exc
    v.result = result
    v.query_language = result.query_language
    # Two digests, not one: the generated query and the one that actually ran
    # (docs/for-developers/governance.md D3). Equal when no lens applied, so
    # *the generated query, exactly as executed* stays true by showing both and
    # saying which ran — rather than by hoping they are the same.
    digests = result.composed.digests if result.composed else {"generated": _sha(v.query), "executed": _sha(v.query)}
    await close_graph(ctx, v, crossing, result=result, digests=digests)
    # One emission carrying the whole result today; ``graph.delta`` batches
    # arrive when the connector streams (docs/for-developers/modules/ask/spec.md build step 8).
    await ctx.emit("result", {"result": result.model_dump(), "message_id": v.assistant_message_id})
    rows = result.row_count
    detail = f"{rows} row{'' if rows == 1 else 's'} · {result.execution_time_ms}ms"
    if _rewritten(result):
        # The reader is told the lens touched the query, not left to notice that
        # two digests differ.
        detail += " · under a lens"
    return Out(
        detail=detail,
        input=query_record(result, digests=digests, timeout_s=v.timeout_s, parameters=bool(v.parameters)),
        output={"rows": rows, "execution_time_ms": result.execution_time_ms, "result_type": result.result_type},
    )


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


async def expand_neighbours(ctx: TaskContext, v: RunVars) -> Out:
    """The neighbours of one vertex, read under the run's lens (GC6 · GC9 · GC10).

    Expand-all, by edge type and by node type are this one callable with
    ``edge_label`` / ``neighbor_label`` — one bound, one failure mode. The lens
    reaches the connector's own traversal builder as structured input (CC22),
    so a denied type is never traversed and the count is taken inside the
    world. A request that *names* a type the world lacks is refused with the
    type named, never answered with zero neighbours (GC13).

    The run's ``result``, ``nodes``, ``edges`` and ``summary`` are what the
    interpreter settles the session's reply from, so the turn is the run (GC12).
    """
    args = ctx.step.args or {}
    vertex_id = str(args.get("vertex_id") or "")
    if not vertex_id:
        raise TaskFailure(cls="blocked", cause="no_vertex", message="No vertex to expand.", short="no vertex")
    direction = str(args.get("direction") or "both")
    edge_label = args.get("edge_label") or None
    neighbor_label = args.get("neighbor_label") or None
    filters = FilterGroup.model_validate(args["filters"]) if args.get("filters") else None
    sort = [SortSpec.model_validate(s) for s in args.get("sort") or []]
    limit = int(args.get("limit") or 50)
    offset = int(args.get("offset") or 0)

    crossing = await open_graph(ctx, v)
    await ctx.progress("waiting for the graph")
    connector = await _connector(ctx, v)
    reader = connector.data_reader
    started = time.monotonic()
    try:
        data = await reader.read_neighbors(
            vertex_id,
            direction=direction,
            edge_label=edge_label,
            neighbor_label=neighbor_label,
            filters=filters,
            sort=sort,
            limit=limit,
            offset=offset,
            lens=crossing.lens,
        )
        total = await reader.count_neighbors(
            vertex_id,
            direction=direction,
            edge_label=edge_label,
            neighbor_label=neighbor_label,
            filters=filters,
            lens=crossing.lens,
        )
    except LensViolationError as exc:
        # Nothing ran: the request named what this world does not hold.
        raise CannotAnswer(reason=str(exc)) from exc
    except ConnectorError as exc:
        raise TaskFailure(
            cls="failed", cause="graph_error", message=f"The graph could not expand this node: {exc}", raw=str(exc)
        ) from exc
    elapsed = round((time.monotonic() - started) * 1000)

    query = data.metadata.query or ""
    result = QueryResponse(
        result_type="graph",
        query_language=_resolve_query_language(connector).value,
        data=data,
        execution_time_ms=elapsed,
        row_count=len(data.edges),
    )
    # The builder composed the lens itself, so what was generated is what ran.
    digests = {"generated": _sha(query), "executed": _sha(query)}
    await close_graph(ctx, v, crossing, result=result, digests=digests)

    # The anchor comes back once per edge; the turn counts what was drawn.
    nodes, edges = len({n.id for n in data.nodes}), len(data.edges)
    v.result, v.query = result, query
    v.nodes, v.edges = nodes, edges
    v.summary = f"Added {_plural(nodes, 'node')} and {_plural(edges, 'relationship')}."
    return Out(
        detail=f"{nodes} node(s) / {edges} edge(s) of {total} · {elapsed}ms",
        input={
            "query": digests,
            "vertex_id": vertex_id,
            "direction": direction,
            **({"edge_label": edge_label} if edge_label else {}),
            **({"neighbor_label": neighbor_label} if neighbor_label else {}),
            "limit": limit,
            "offset": offset,
        },
        output={
            "nodes": [n.model_dump(mode="json") for n in data.nodes],
            "edges": [e.model_dump(mode="json") for e in data.edges],
            "metadata": data.metadata.model_dump(mode="json"),
            "total": total,
            "has_more": offset + edges < total,
        },
    )


def _preview_refusal(exc: Exception) -> str | None:
    """A rule the lens refuses, or one the graph cannot count, is that rule's verdict."""
    if isinstance(exc, LensViolationError):
        return str(exc)
    if isinstance(exc, QueryExecutionError):
        return f"The graph could not count this rule: {exc}"
    return None


async def preview_stitches(ctx: TaskContext, v: RunVars) -> Out:
    """What each stitch rule resolves, read under the run's lens (ST43).

    The drawer previews one undeclared rule; `invana stitches resolve` asks of
    every declared stitch, with what each active one has written. Both queries
    are generated openCypher, handed to the connector with the lens like any
    other read — a rule naming a type or key the guardrails deny is refused
    with that reason, never counted around it.
    """
    args = ctx.step.args or {}
    crossing = await open_graph(ctx, v)
    await ctx.progress("counting what each rule resolves")
    sent: list[str] = []
    rows = 0
    elapsed = 0
    language = "cypher"

    async def read(query: str, parameters: dict | None) -> dict:
        nonlocal rows, elapsed, language
        result = await execute_query(
            ctx.db,
            graph=v.graph,
            manager=ctx.manager,
            query=query,
            parameters=parameters,
            actor_id=v.actor_id,
            lens=crossing.lens,
        )
        sent.append(result.composed.executed if result.composed else query)
        rows += result.row_count
        elapsed += result.execution_time_ms
        language = result.query_language
        found = result.rows or []
        return found[0] if found else {}

    try:
        previews = await stitching.preview_rules(
            ctx.db,
            graph_id=ctx.step.graph_id,
            rules=list(args.get("rules") or []),
            all_links=bool(args.get("all_links")),
            read=read,
            refused=_preview_refusal,
        )
    except HTTPException as exc:
        raise http_failure(exc) from exc

    text = "\n".join(sent)
    digests = {"generated": _sha(text), "executed": _sha(text)}
    summary = QueryResponse(result_type="tabular", query_language=language, execution_time_ms=elapsed, row_count=rows)
    await close_graph(ctx, v, crossing, result=summary, digests=digests)
    refused = sum(1 for p in previews if p["refused"])
    return Out(
        detail=f"{len(previews)} rule(s) counted" + (f" · {refused} refused" if refused else ""),
        input={"query": digests, "rules": len(previews)},
        output={"previews": previews},
    )


async def _connector(ctx: TaskContext, v: RunVars):
    try:
        _, connector = await _resolve_connector(ctx.db, graph=v.graph, manager=ctx.manager)
    except HTTPException as exc:
        raise http_failure(exc) from exc
    return connector


def _type_rows(counts: dict[str, int] | None, labels: list[str]) -> list[dict]:
    """Biggest first; a vendor that cannot count keeps its own order, with no numbers (SP8)."""
    if counts is None:
        return [{"name": label, "count": None} for label in labels]
    rows = [{"name": label, "count": int(n)} for label, n in counts.items()]
    rows.sort(key=lambda r: (-r["count"], r["name"]))
    return rows


async def count_types(ctx: TaskContext, v: RunVars) -> Out:
    """Every node and edge type the run's world holds, counted inside it (SP11).

    One node query and one edge query, whatever the number of types (SP8). A
    type the world denies is absent, not zero; each count is taken inside that
    type's slice; an edge counts only when both of its ends are in the world.
    """
    crossing = await open_graph(ctx, v)
    await ctx.progress("counting types")
    connector = await _connector(ctx, v)
    reader = connector.schema_reader
    started = time.monotonic()
    try:
        nodes, edges = await reader.count_types(crossing.lens)
        node_labels = await reader.get_node_labels() if nodes is None else []
        edge_labels = await reader.get_edge_labels() if edges is None else []
    except LensViolationError as exc:
        raise CannotAnswer(reason=str(exc)) from exc
    except ConnectorError as exc:
        raise TaskFailure(
            cls="failed", cause="graph_error", message=f"The graph could not count its types: {exc}", raw=str(exc)
        ) from exc
    elapsed = round((time.monotonic() - started) * 1000)
    node_rows, edge_rows = _type_rows(nodes, node_labels), _type_rows(edges, edge_labels)
    summary = QueryResponse(
        result_type="tabular",
        query_language=_resolve_query_language(connector).value,
        execution_time_ms=elapsed,
        row_count=len(node_rows) + len(edge_rows),
    )
    marker = "count_types"
    await close_graph(ctx, v, crossing, result=summary, digests={"generated": _sha(marker), "executed": _sha(marker)})
    return Out(
        detail=f"{len(node_rows)} node type(s) · {len(edge_rows)} edge type(s) · {elapsed}ms",
        input={},
        output={
            "node_types": node_rows,
            "edge_types": edge_rows,
            "counted": nodes is not None or edges is not None,
        },
    )


async def resolve_elements(ctx: TaskContext, v: RunVars) -> Out:
    """What of a reopened canvas the graph still holds, inside the run's world (GC14).

    ``present`` is in the graph and in this world; ``missing`` is gone from the
    graph and is kept and marked (GC5). An element the world excludes is in
    **neither** — the canvas is never told what the world hides, it simply does
    not draw it. One query for the whole canvas, and no property is read.
    """
    ids = [str(i) for i in (ctx.step.args or {}).get("vertex_ids") or []]
    crossing = await open_graph(ctx, v)
    await ctx.progress("checking the canvas against the graph")
    connector = await _connector(ctx, v)
    started = time.monotonic()
    try:
        held = await connector.data_reader.resolve_vertices(ids, lens=crossing.lens)
    except LensViolationError as exc:
        raise CannotAnswer(reason=str(exc)) from exc
    except ConnectorError as exc:
        raise TaskFailure(
            cls="failed", cause="graph_error", message=f"The graph could not check this canvas: {exc}", raw=str(exc)
        ) from exc
    elapsed = round((time.monotonic() - started) * 1000)
    present = [i for i in ids if held.get(i) is True]
    missing = [i for i in ids if i not in held]
    summary = QueryResponse(
        result_type="tabular",
        query_language=_resolve_query_language(connector).value,
        execution_time_ms=elapsed,
        row_count=len(held),
    )
    marker = "resolve_elements"
    await close_graph(ctx, v, crossing, result=summary, digests={"generated": _sha(marker), "executed": _sha(marker)})
    return Out(
        detail=f"{len(present)} present · {len(missing)} missing of {len(ids)} · {elapsed}ms",
        input={"checked": len(ids)},
        output={"present": present, "missing": missing},
    )


ENTRIES = build(
    Entry(
        key="execute_graph_query",
        summary="Run a validated query against the graph, under the run's lens.",
        bound=Bound.graph_read,
        run=execute_graph_query,
        args={"query": Arg(Type.str_), "read_only": Arg(Type.bool_, default=True)},
        outputs={"rows": Type.int_, "execution_time_ms": Type.int_, "result_type": Type.str_},
        requires=("validate_query",),
    ),
    Entry(
        key="preview_stitches",
        summary="Count what stitch rules resolve — one draft, or every declared stitch — under the run's lens.",
        bound=Bound.graph_read,
        run=preview_stitches,
        args={"rules": Arg(Type.list_), "all_links": Arg(Type.bool_, default=False)},
        outputs={"previews": Type.list_},
    ),
    Entry(
        key="count_types",
        summary="Count every node and edge type the run's world holds, inside it.",
        bound=Bound.graph_read,
        run=count_types,
        outputs={"node_types": Type.list_, "edge_types": Type.list_, "counted": Type.bool_},
    ),
    Entry(
        key="resolve_elements",
        summary="Check a canvas's elements against the graph, under the run's world.",
        bound=Bound.graph_read,
        run=resolve_elements,
        args={"vertex_ids": Arg(Type.list_, required=True)},
        outputs={"present": Type.list_, "missing": Type.list_},
    ),
    Entry(
        key="expand_neighbours",
        summary="Read one vertex's neighbours — all, by edge type or by node type — under the run's lens.",
        bound=Bound.graph_read,
        run=expand_neighbours,
        args={
            "vertex_id": Arg(Type.str_, required=True),
            "direction": Arg(Type.str_, default="both"),
            "edge_label": Arg(Type.str_),
            "neighbor_label": Arg(Type.str_),
            "filters": Arg(Type.obj),
            "sort": Arg(Type.list_),
            "limit": Arg(Type.int_, default=50),
            "offset": Arg(Type.int_, default=0),
        },
        outputs={
            "nodes": Type.list_,
            "edges": Type.list_,
            "metadata": Type.obj,
            "total": Type.int_,
            "has_more": Type.bool_,
        },
    ),
)
