"""The ``graph.read.query`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from fastapi import HTTPException

from invana.apps.govern.guardrail import parse_target
from invana.apps.govern.managers.request import RequestManager, asker_of
from invana.apps.govern.models import RequestKind
from invana.apps.govern.querysets import LensQuerySet
from invana.apps.graphs.query_service import QueryExecutionError, execute_query
from invana.graph.connectors.base.exceptions import LensViolationError
from invana.plugins.core.graph_read.shared import _rewritten, query_record
from invana.plugins.sdk.context import (
    Out,
    RunVars,
    TaskContext,
    _query_failure,
    _sha,
    close_graph,
    http_failure,
    open_graph,
)
from invana.plugins.sdk.errors import CannotAnswer
from invana.runtime.models import RunRole


async def graph_read_query(ctx: TaskContext, v: RunVars) -> Out:
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
            session_id=v.sess.id if v.sess else None,
            timeout_s=v.timeout_s,
            lens=crossing.lens,
        )
    except LensViolationError as exc:
        raise await _refused(ctx, v, exc) from exc
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


#: The refusals a Graph guardrail makes — the property is kept out, or counted only.
_GUARDED = frozenset({"lens_property_excluded", "lens_property_counts_only"})

_requests = RequestManager()
_lenses = LensQuerySet()


def _guardrail_holding(v: RunVars, exc: LensViolationError) -> dict | None:
    """The Graph guardrail the run froze that holds the refused property, if one does."""
    if exc.code not in _GUARDED or not exc.property_name or v.governor is None:
        return None
    for contributor in v.governor.effective.contributors:
        if contributor.get("scope") != "graph" or not contributor.get("target"):
            continue
        if parse_target(contributor["target"]).covers(exc.type_name or "", exc.property_name):
            return contributor
    return None


async def _refused(ctx: TaskContext, v: RunVars, exc: LensViolationError) -> CannotAnswer:
    """The lens refused the query: *cannot answer*, and a request when a guardrail did it.

    A refusal by a Graph guardrail names the guardrail and files (or adds to) a
    ``guardrail`` request with it as the blocker. Eval and test replays file
    nothing — nobody asked them.
    """
    guardrail = _guardrail_holding(v, exc)
    if guardrail is None:
        return CannotAnswer(reason=str(exc))
    needs = f"{exc.type_name}.{exc.property_name}" if exc.type_name else exc.property_name
    reason = f'Cannot answer — this needs {needs}, kept out by the guardrail "{guardrail.get("name")}".'
    run = v.run
    if run is None or run.role != RunRole.evaluate.value:
        lens = await _lenses.get(ctx.db, guardrail["id"])
        if lens is not None:
            asker = asker_of(
                triggered_by=run.triggered_by if run else None,
                author_id=run.author_id if run else v.actor_id,
                agent_id=run.agent_id if run else None,
                in_session=v.sess is not None,
            )
            filed = await _requests.file_quietly(
                ctx.db,
                graph_id=v.graph.id,
                kind=RequestKind.guardrail,
                title=v.prompt or needs,
                detail=reason,
                source=asker.source,
                asked_by_id=asker.asked_by_id,
                agent_id=asker.agent_id,
                run_id=run.id if run else None,
                session_id=v.sess.id if v.sess else None,
                guardrail=lens,
            )
            if filed is not None:
                return CannotAnswer(reason=reason, exchange={"request_id": filed.id})
    return CannotAnswer(reason=reason)


run = graph_read_query
