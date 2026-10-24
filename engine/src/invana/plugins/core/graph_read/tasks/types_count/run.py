"""The ``graph.read.types_count`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import time

from invana.apps.graphs.query_service import _resolve_query_language
from invana.apps.graphs.schemas import QueryResponse
from invana.graph.connectors.base.exceptions import ConnectorError, LensViolationError
from invana.plugins.core.graph_read.shared import _connector, _type_rows
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _sha, close_graph, open_graph
from invana.plugins.sdk.errors import CannotAnswer, TaskFailure


async def graph_read_types_count(ctx: TaskContext, v: RunVars) -> Out:
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
    marker = "graph.read.types_count"
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


run = graph_read_types_count
