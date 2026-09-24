"""Bound: *none* — the entries that spend nothing
(docs/for-developers/orchestration.md §0.6).

They read what earlier steps left on ``RunVars``, decide something about it and
write it down. No model call, no query, no row anyone has to pay for.
"""

from __future__ import annotations

from sqlalchemy import select

from invana.apps.llm.translate import _looks_read_only
from invana.runtime.catalogue.contract import (
    Out,
    RunVars,
    TaskContext,
    TaskFailure,
    _plural,
    _sha,
    labels_in,
    query_language_for,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build
from invana.runtime.emissions import produce as produce_emission
from invana.runtime.emissions import to_dict as emission_to_dict
from invana.runtime.models import TaskRun


async def validate_query(ctx: TaskContext, v: RunVars) -> Out:
    """A query is never run unvalidated — the read-only check, as a step on the record.

    ``args.query`` lets a compound plan validate *this branch's* query rather
    than whatever the last translate step happened to leave behind; the
    binding was resolved before dispatch, so by here it is a literal.
    """
    query = str((ctx.step.args or {}).get("query") or "") or v.query or v.prompt
    v.query = query
    language = await query_language_for(ctx, v, strict=False)
    if not _looks_read_only(query, language):
        raise TaskFailure(
            cls="blocked",
            cause="query_not_read_only",
            message="That query would write to the graph — Invana only runs read-only queries.",
            short="not read-only",
            evidence={"generated_query": query},
        )
    labels = labels_in(query, language)
    return Out(
        detail="read-only ✓" + (f" · {', '.join(labels)}" if labels else ""),
        input={"query_sha": _sha(query), "language": language},
        output={"verdict": "read-only", "labels": labels},
    )


async def shape_for_canvas(ctx: TaskContext, v: RunVars) -> Out:
    """Project: records become an **emission**, through a template.

    This is the `project` step of the pipeline
    (docs/for-developers/modules/ask/features/the-answer-surface.md). It declares the
    emission's kind (AS2) by asking the chosen template what surface it produces,
    writes the emission as a row so the answer survives a reload (AS10), and
    carries the citation — the query and the record count — with it (AS3).

    The offer list travels on the stream frame so the emission header's picker can
    show every other template that would render these same records, and the reason
    the rest cannot (P10) — without re-running anything (P5).
    """
    assert v.result is not None
    r = v.result
    v.nodes = len(r.data.nodes) if r.data else 0
    v.edges = len(r.data.edges) if r.data else 0

    emission, offers, shape = await produce_emission(
        ctx.db,
        run_id=ctx.step.parent_run_id,
        graph_id=v.graph.id,
        result=r,
        query=v.query,
        message_id=v.assistant_message_id,
        step_id=ctx.step.id,
        intent=v.prompt,
    )
    await ctx.emit("emission", emission_to_dict(emission, offers=offers))

    if emission.kind == "empty":
        # Zero rows is an answer — "the graph does not hold this" — worded as one
        # rather than drawn as a blank table (AS7).
        v.summary = emission.payload.get("statement", "")
        detail = "nothing held → the empty answer"
    elif r.result_type == "graph":
        v.summary = f"Returned {_plural(v.nodes, 'node')} and {_plural(v.edges, 'relationship')}."
        detail = f"{_plural(v.nodes, 'node')} · {_plural(v.edges, 'relationship')} → canvas"
    else:
        v.summary = f"Returned {_plural(r.row_count, 'row')}."
        detail = f"{r.row_count} row{'' if r.row_count == 1 else 's'} → {emission.kind}"

    return Out(
        detail=detail,
        output={
            "nodes": v.nodes,
            "edges": v.edges,
            "result_type": r.result_type,
            "emission_id": emission.id,
            "emission_kind": emission.kind,
            # NULL when no template chose it — the header says "no template"
            # rather than naming a default so the row looks complete (AS9).
            "template_id": emission.template_id,
            "single_value": shape.is_single_value,
        },
    )


async def verify_result(ctx: TaskContext, v: RunVars) -> Out:
    """Did the plan serve the intent? **Deterministic first** (docs/for-developers/modules/agents/spec.md).

    The intent carries an expected shape and the types it is about; the result
    either matches or it does not. No LLM judge — a self-report about whether
    an answer is good is not evidence, and this step exists to turn "silent
    empty result" into a visible outcome.
    """
    checks: list[dict] = []
    intent = v.intent

    if v.result is not None:
        rows = v.result.row_count
        checks.append({"check": "rows", "ok": rows > 0, "detail": f"{rows} row{'' if rows == 1 else 's'}"})
        if intent and intent.refs:
            haystack = (v.query or "").lower()
            missing = [r for r in intent.refs if r.lower() not in haystack]
            checks.append(
                {
                    "check": "types",
                    "ok": not missing,
                    "detail": "all present" if not missing else f"missing {', '.join(missing)}",
                }
            )
        if intent and intent.expects:
            got = {"graph" if v.nodes or v.edges else "table"}
            wanted = set(intent.expects) & {"graph", "table"}
            checks.append(
                {
                    "check": "shape",
                    "ok": not wanted or bool(wanted & got),
                    "detail": f"expected {', '.join(sorted(wanted)) or 'any'} · got {', '.join(sorted(got))}",
                }
            )
    elif v.proposal is not None:
        checks.append({"check": "proposal", "ok": True, "detail": "model draft staged"})
    else:
        checks.append({"check": "result", "ok": False, "detail": "nothing was produced"})

    failed = [c for c in checks if not c["ok"]]
    served = "yes" if not failed else ("partial" if len(failed) < len(checks) else "no")
    v.verdict = served
    await ctx.emit("plan.verified", {"served": served, "evidence": checks})
    return Out(
        detail={"yes": "served", "partial": "partial", "no": "not served"}[served]
        + (f" · {failed[0]['detail']}" if failed else ""),
        input={"intent": intent.as_dict() if intent else None},
        output={"served": served, "evidence": checks},
    )


async def await_delegations(ctx: TaskContext, v: RunVars) -> Out:
    """Fan-in for a plan that delegated more than once before waiting.

    **This is control flow, and § 0.6 says control flow is never a catalogue
    entry.** It is declared here because ``COORDINATOR`` allows it by key
    today; the-runtime-package.md § 6.2 moves it into ``interpreter/``.
    """
    from invana.runtime.delegation import await_children

    ids = [str(i) for i in ((ctx.step.args or {}).get("run_ids") or [])]
    if not ids and v.run is not None:
        # The children of this run's nodes. A delegated run names the node that
        # delegated it, and that node names this run — so the edge is already
        # written, and a `child_run_id` column would be a third copy of it that
        # can disagree with the other two.
        nodes = select(TaskRun.id).where(TaskRun.parent_run_id == v.run.id)
        rows = (await ctx.db.execute(select(TaskRun.id).where(TaskRun.parent_run_id.in_(nodes)))).scalars().all()
        ids = [r for r in rows if r]
    if not ids:
        return Out(detail="nothing to wait for", output={"children": []})
    outcomes = await await_children(ctx.db, run_ids=ids)
    for outcome in outcomes:
        v.delegated.extend(outcome.emitted)
    failed = [o for o in outcomes if o.status != "succeeded"]
    if failed:
        raise TaskFailure(
            cls="blocked",
            cause="delegation_failed",
            message=f"{len(failed)} of {len(outcomes)} delegations did not finish.",
            short="child failed",
            evidence={"children": [o.run_id for o in failed]},
        )
    return Out(
        detail=f"{_plural(len(outcomes), 'child')} finished",
        output={"children": [{"run_id": o.run_id, "status": o.status} for o in outcomes]},
    )


ENTRIES = build(
    Entry(
        key="validate_query",
        summary="Check a query is read-only and name the labels it touches, before it runs.",
        bound=Bound.none,
        run=validate_query,
        args={"query": Arg(Type.str_)},
        outputs={"verdict": Type.str_, "labels": Type.list_},
    ),
    Entry(
        key="shape_for_canvas",
        summary="Turn query records into an emission for the canvas, through a template.",
        bound=Bound.none,
        run=shape_for_canvas,
        outputs={
            "nodes": Type.int_,
            "edges": Type.int_,
            "result_type": Type.str_,
            "emission_id": Type.str_,
            "emission_kind": Type.str_,
            "template_id": Type.str_,
            "single_value": Type.bool_,
        },
        requires=("execute_graph_query",),
    ),
    Entry(
        key="verify_result",
        summary="Decide whether the plan served the intent — deterministic checks first.",
        bound=Bound.none,
        run=verify_result,
        outputs={"served": Type.str_, "evidence": Type.list_},
    ),
    Entry(
        key="await_delegations",
        summary="Wait for every child run this plan delegated, then hand on their results.",
        bound=Bound.none,
        run=await_delegations,
        args={"run_ids": Arg(Type.list_)},
        outputs={"children": Type.list_},
    ),
)
