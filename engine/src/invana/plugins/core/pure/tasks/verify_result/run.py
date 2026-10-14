"""The ``verify_result`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.sdk.context import Out, RunVars, TaskContext


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


run = verify_result
