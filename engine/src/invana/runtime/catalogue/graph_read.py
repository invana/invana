"""Bound: ``graph_read`` — the entries that read the bound graph database
(docs/for-developers/orchestration.md §0.6).

One entry today. Dialect is a connector concern, not a catalogue one: Gremlin
does not get a second key.
"""

from __future__ import annotations

from fastapi import HTTPException

from invana.apps.graphs.query_service import QueryExecutionError, execute_query
from invana.runtime.catalogue.contract import (
    Out,
    RunVars,
    TaskContext,
    _query_failure,
    _sha,
    http_failure,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build


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
    # One emission carrying the whole result today; ``graph.delta`` batches
    # arrive when the connector streams (docs/for-developers/modules/ask/spec.md build step 8).
    await ctx.emit("result", {"result": result.model_dump(), "message_id": v.assistant_message_id})
    rows = result.row_count
    detail = f"{rows} row{'' if rows == 1 else 's'} · {result.execution_time_ms}ms"
    if result.composed is not None and result.composed.rewritten:
        # The reader is told the lens touched the query, not left to notice that
        # two digests differ.
        detail += " · under a lens"
    return Out(
        detail=detail,
        input={"query": digests, "timeout_s": v.timeout_s, "parameters": bool(v.parameters)},
        output={"rows": rows, "execution_time_ms": result.execution_time_ms, "result_type": result.result_type},
    )


ENTRIES = build(
    Entry(
        key="execute_graph_query",
        bound=Bound.graph_read,
        run=execute_graph_query,
        args={"query": Arg(Type.str_), "read_only": Arg(Type.bool_, default=True)},
        outputs={"rows": Type.int_, "execution_time_ms": Type.int_, "result_type": Type.str_},
        requires=("validate_query",),
    ),
)
