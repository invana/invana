"""The ``expand_neighbours`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import time

from invana.apps.graphs.query_service import _resolve_query_language
from invana.apps.graphs.schemas import QueryResponse
from invana.graph.connectors.base.exceptions import ConnectorError, LensViolationError
from invana.graph.types.filters import FilterGroup
from invana.graph.types.sort import SortSpec
from invana.plugins.core.graph_read.shared import _connector, _plural
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _sha, close_graph, open_graph
from invana.plugins.sdk.errors import CannotAnswer, TaskFailure


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


run = expand_neighbours
