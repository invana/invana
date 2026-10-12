"""The ``preview_stitches`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from fastapi import HTTPException

from invana.apps.graphs.query_service import execute_query
from invana.apps.graphs.schemas import QueryResponse
from invana.plugins.core.graph_read.shared import _preview_refusal
from invana.plugins.core.ingest import stitching
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _sha, close_graph, http_failure, open_graph


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


run = preview_stitches
