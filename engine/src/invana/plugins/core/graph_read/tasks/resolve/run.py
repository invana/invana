"""The ``graph.read.resolve`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import time

from invana.apps.graphs.query_service import _resolve_query_language
from invana.apps.graphs.schemas import QueryResponse
from invana.graph.connectors.base.exceptions import ConnectorError, LensViolationError
from invana.plugins.core.graph_read.shared import _connector
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _sha, close_graph, open_graph
from invana.plugins.sdk.errors import CannotAnswer, TaskFailure


async def graph_read_resolve(ctx: TaskContext, v: RunVars) -> Out:
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
    marker = "graph.read.resolve"
    await close_graph(ctx, v, crossing, result=summary, digests={"generated": _sha(marker), "executed": _sha(marker)})
    return Out(
        detail=f"{len(present)} present · {len(missing)} missing of {len(ids)} · {elapsed}ms",
        input={"checked": len(ids)},
        output={"present": present, "missing": missing},
    )


run = graph_read_resolve
