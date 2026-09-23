"""Bound: ``graph_read`` — the entries that read the bound graph database
(docs/for-developers/orchestration.md §0.6).

One entry today. Dialect is a connector concern, not a catalogue one: Gremlin
does not get a second key.

This is where a run engages the ``graph_data`` layer, so it is where the lens
bites — through the contract's ``open_graph`` / ``close_graph``, which own what
a crossing *is* so that an entry stays a view over one app. The version is
checked before the query is sent, the narrowing is handed to the connector as a
``QueryLens``, and one touch is recorded carrying both digests. **Nothing is
enforced by filtering afterwards**
([govern § 2](docs/for-developers/modules/govern/spec.md)).
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
