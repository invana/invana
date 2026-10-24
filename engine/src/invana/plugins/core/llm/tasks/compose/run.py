"""The ``plan.compose`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm import LLMError
from invana.apps.llm.planner import generate_plan
from invana.plugins.core.llm.shared import _exchange, _vocabulary
from invana.plugins.sdk.context import (
    Out,
    RunVars,
    TaskContext,
    _plural,
    _provider_label,
    close_model,
    offered_rule_version_ids,
    offered_skill_version_ids,
    open_model,
)
from invana.plugins.sdk.errors import TaskFailure


async def plan_compose(ctx: TaskContext, v: RunVars) -> Out:
    """Serve the intent: match a template, or compose one.

    The common case costs **no LLM call** — a `single_query` intent is the
    seeded tail, and a QL ask is that tail minus translation. The model plans
    only when the intent's shape has no library entry, and whatever it proposes
    is validated against the envelope before a single step is queued.
    """
    from invana.runtime.planning import PlanRejected, resolve_plan, select_plan

    envelope = v.envelope
    assert envelope is not None
    intent_kind = v.intent.kind if v.intent else ("typed_query" if v.mode == "ql" else "single_query")

    selected = await select_plan(
        ctx.db, envelope=envelope, graph_id=ctx.step.graph_id, ask_kind=v.mode, intent_kind=intent_kind
    )
    if selected is not None:
        steps, source = resolve_plan(
            envelope=envelope,
            raw_steps=[dict(s) for s in selected.steps],
            source=f"template:{selected.ref}",
            declares=selected.declares,
        )
        v.plan_steps, v.plan_origin = steps, source
        # The run records *which plan*, not only which flavour of provenance —
        # `plan_origin` says `template:nl-single@1` and `flow_id` names the
        # row, so the trace opens the plan a person can read (LB12).
        v.flow_id = selected.plan_id
        ctx.planned = steps
        return Out(
            detail=f"plan {selected.key}@{selected.version} · {_plural(len(steps), 'step')} · no LLM",
            input={"intent": intent_kind, "ask_kind": v.mode},
            output={"source": source, "plan_id": selected.plan_id, "steps": [s.as_dict() for s in steps]},
        )

    # No template fits — the model plans, inside the envelope.
    if v.provider is None:
        raise TaskFailure(
            cls="blocked",
            cause="no_provider",
            message="No LLM provider is bound to this agent, and no template fits this ask.",
            short="no provider",
        )
    crossing = await open_model(ctx, v)
    ctx.step.skills_offered = offered_skill_version_ids(v)
    ctx.step.rules_offered = offered_rule_version_ids(v)
    await ctx.progress(f"{_provider_label(v.provider)} · composing a plan")
    errors: list[str] | None = None
    # one proposal, one repair — that budget, one level up
    # (docs/for-developers/modules/ask/features/when-it-cannot-answer.md)
    for attempt in range(2):
        try:
            proposed = await generate_plan(
                provider=v.provider,
                intent=v.intent.as_dict() if v.intent else {"kind": intent_kind, "summary": v.prompt},
                prompt=v.prompt,
                vocabulary=_vocabulary(envelope),
                max_steps=envelope.max_steps,
                pins=envelope.pins,
                encryption_key=v.encryption_key,
                repair_errors=errors,
                **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
            )
        except LLMError as exc:
            raise TaskFailure(
                cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
            ) from exc
        v.llm_ms = (v.llm_ms or 0) + proposed.duration_ms
        # Recorded per attempt: the repair is a second crossing and a second
        # spend, and a ledger that counted one would understate what the run did.
        await close_model(ctx, v, crossing, usage=proposed.usage, duration_ms=proposed.duration_ms)
        try:
            steps, source = resolve_plan(envelope=envelope, raw_steps=proposed.steps, source="generated")
        except PlanRejected as rejected:
            errors = rejected.errors
            if attempt == 0:
                await ctx.emit("plan.rejected", {"errors": errors, "attempt": attempt + 1})
                continue
            raise TaskFailure(
                cls="repairable",
                cause="plan_invalid",
                message="I couldn't compose a plan for that inside this agent's limits.",
                short="plan rejected",
                evidence={"errors": errors},
            ) from rejected
        v.plan_steps, v.plan_origin = steps, source
        ctx.planned = steps
        usage = proposed.usage
        return Out(
            detail=f"generated · {_plural(len(steps), 'step')}",
            input={"intent": intent_kind, "allowed": sorted(envelope.allow)},
            output={
                "source": source,
                "rationale": proposed.rationale,
                "steps": [s.as_dict() for s in steps],
                **_exchange(proposed),
            },
            tokens_in=usage.input_tokens if usage else None,
            tokens_out=usage.output_tokens if usage else None,
        )
    raise TaskFailure(cls="defect", cause="internal", message="The planner returned nothing.", short="no plan")


run = plan_compose
