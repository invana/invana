"""Bound: ``llm`` — the entries that spend a model call
(docs/for-developers/orchestration.md §0.6).

``understand_intent`` reads the ask, ``plan_workflow`` serves it, ``translate_thought``
turns it into a query, ``propose_model`` drafts node and edge types. Each is a
**view**: parse args, call one manager in one app, serialise the declared
outputs (docs/for-developers/building-engine/the-runtime-package.md §4).
"""

from __future__ import annotations

from invana.apps.llm import LLMError, QueryNotReadOnlyError
from invana.apps.llm.clarify import ground_options
from invana.apps.llm.grounding import render_skills
from invana.apps.llm.intent import OutOfScope, understand
from invana.apps.llm.planner import generate_plan
from invana.apps.llm.propose import propose_model
from invana.apps.llm.translate import Clarification, nl_to_query
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event
from invana.runtime.catalogue.contract import (
    CannotAnswer,
    NeedsInput,
    Out,
    RunVars,
    TaskContext,
    TaskFailure,
    _line_count,
    _plural,
    _provider_label,
    _report_ids,
    offered_skill_ids,
    query_language_for,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build


def _exchange(outcome) -> dict:
    """The prompt and the completion, for the step dashboard's Output band.

    **Deliberately undeclared** (SR42). Declaration is what makes an output
    bindable (`orchestration.md` §0.6), so keeping these two off the entry's
    ``outputs`` is what keeps a plan out of a step's internals — while leaving
    them visible to the person reading the trace, which is who they are for.
    """
    exchange = getattr(outcome, "exchange", None)
    if exchange is None or not (exchange.prompt or exchange.completion):
        return {}
    return {"prompt": exchange.prompt, "completion": exchange.completion}


async def understand_intent(ctx: TaskContext, v: RunVars) -> Out:
    """What the ask means here — before a single character of query is written.

    Three outcomes, and the two that are not "understood" are the point of the
    step existing: a clarification settles *before* a plan is made, and
    *cannot answer* becomes a judgement about the graph's boundary rather than
    something discovered after an empty result.
    """
    assert v.provider is not None
    ctx.step.skills_offered = offered_skill_ids(v)
    await ctx.progress(f"{_provider_label(v.provider)} · reading the ask against the model")
    try:
        outcome = await understand(
            provider=v.provider,
            prompt=v.prompt,
            version=v.grounding,
            encryption_key=v.encryption_key,
            instructions=v.instructions,
            skills=render_skills(v.skills),
            history=v.history,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc

    v.via = _provider_label(v.provider)
    v.llm_ms = (v.llm_ms or 0) + outcome.duration_ms
    usage = outcome.usage

    if isinstance(outcome, OutOfScope):
        # The run **succeeds** — "I can't answer that" is an outcome, not
        # a failure (promise #4). The plan never happens, and the trace says why.
        v.summary = outcome.reason
        await ctx.emit("cannot_answer", {"reason": outcome.reason, "stage": "understand"})
        raise CannotAnswer(reason=outcome.reason)

    if isinstance(outcome, Clarification):
        options = await _options(ctx, v, outcome)
        ctx.step.tokens_in = usage.input_tokens if usage else None
        ctx.step.tokens_out = usage.output_tokens if usage else None
        ctx.step.output = {"question": outcome.question, "options": options, **_exchange(outcome)}
        raise NeedsInput(question=outcome.question, options=options)

    v.intent = outcome
    ctx.step.skills_applied = _report_ids(v, outcome.skills_applied)
    refs = ", ".join(outcome.refs[:4])
    return Out(
        detail=f"{outcome.kind.replace('_', ' ')}" + (f" · {refs}" if refs else ""),
        input={"prompt": v.prompt, "answering": v.answering, "model": v.via},
        output={**outcome.as_dict(), **_exchange(outcome)},
        tokens_in=usage.input_tokens if usage else None,
        tokens_out=usage.output_tokens if usage else None,
    )


async def plan_workflow(ctx: TaskContext, v: RunVars) -> Out:
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
        )
        v.plan_steps, v.plan_origin = steps, source
        # The run records *which plan*, not only which flavour of provenance —
        # `plan_origin` says `template:nl-single@1` and `task_plan_id` names the
        # row, so the trace opens the plan a person can read (LB12).
        v.task_plan_id = selected.plan_id
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
    ctx.step.skills_offered = offered_skill_ids(v)
    await ctx.progress(f"{_provider_label(v.provider)} · composing a workflow")
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
                message="I couldn't compose a workflow for that inside this agent's limits.",
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


async def translate_thought(ctx: TaskContext, v: RunVars) -> Out:
    """NL → grounded query via the bound provider (docs/for-developers/modules/ask/features/ask-in-natural-language.md);
    asks back when ambiguous (docs/for-developers/modules/ask/features/clarifying-questions.md).

    A compound plan runs this step more than once, each time with its own
    ``ask`` — one sub-question per step, so *Translate A* and *Translate B* are
    two rows a reader can tell apart rather than one row that did two things.
    """
    assert v.provider is not None
    ask = str((ctx.step.args or {}).get("ask") or "").strip() or v.prompt
    ctx.step.skills_offered = offered_skill_ids(v)
    turns = len(v.history) // 2
    await ctx.progress(f"{_provider_label(v.provider)} · reading {turns} prior turn{'' if turns == 1 else 's'}")
    language = await query_language_for(ctx, v, strict=True)
    try:
        generated = await nl_to_query(
            provider=v.provider,
            prompt=ask,
            language=language,
            version=v.grounding,
            encryption_key=v.encryption_key,
            skills=render_skills(v.skills),
            instructions=v.instructions,
            history=v.history,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except QueryNotReadOnlyError as exc:
        # The model answered and Invana declined the answer. Reported as a model
        # failure it sent the reader to the LLM settings page, which is the one
        # part of the chain that was working — and the query it refused never
        # reached the trace. `validate_query` says the same thing the same way.
        raise TaskFailure(
            cls="blocked",
            cause="query_not_read_only",
            message=exc.message,
            short="not read-only",
            evidence={"generated_query": exc.query},
        ) from exc
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc

    v.via = _provider_label(v.provider)
    v.llm_ms = generated.duration_ms
    usage = generated.usage

    if isinstance(generated, Clarification):
        options = await _options(ctx, v, generated)
        await _clarify_event(ctx, v, question=generated.question, usage=usage, duration_ms=generated.duration_ms)
        ctx.step.tokens_in, ctx.step.tokens_out = usage.input_tokens, usage.output_tokens
        ctx.step.input = {
            "prompt": v.prompt,
            "answering": v.answering,
            "context_turns": turns,
            "model": v.via,
        }
        ctx.step.output = {"question": generated.question, "options": options, **_exchange(generated)}
        raise NeedsInput(question=generated.question, options=options)

    v.query = generated.query
    v.query_language = generated.language
    v.rationale = generated.rationale or None
    ctx.step.skills_applied = _report_ids(v, generated.skills_applied)
    if generated.rationale:
        await ctx.emit("reasoning", {"text": generated.rationale})
    await ctx.emit(
        "query.proposed",
        {"query": generated.query, "language": generated.language, "rationale": generated.rationale, "via": v.via},
    )
    await emit_event(
        ctx.db,
        action=actions.LLM_TRANSLATE,
        target_kind=actions.TARGET_SESSION,
        target_id=v.sess.id,
        graph_id=v.graph.id,
        actor_id=v.actor_id,
        details={
            "provider": v.provider.provider.value,
            "model_id": v.provider.model_id,
            "language": generated.language,
            "generated_query": generated.query,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "duration_ms": round(generated.duration_ms),
        },
        trace_id=current_trace_id(),
    )
    return Out(
        detail=f"proposed {generated.language.title()} · {_line_count(generated.query)} line"
        f"{'' if _line_count(generated.query) == 1 else 's'}",
        input={
            "prompt": v.prompt,
            "answering": v.answering,
            "schema": getattr(v.grounding, "id", None),
            "context_turns": turns,
            "model": v.via,
            "timeout_s": v.timeout_s,
        },
        output={
            "query": generated.query,
            "language": generated.language,
            "rationale": generated.rationale,
            "ask": ask,
            **_exchange(generated),
        },
        tokens_in=usage.input_tokens,
        tokens_out=usage.output_tokens,
    )


async def propose_model_task(ctx: TaskContext, v: RunVars) -> Out:
    """Node and edge types for the described change, staged on the draft."""
    assert v.provider is not None and v.draft is not None
    await ctx.progress(f"{_provider_label(v.provider)} · proposing node and edge types")
    try:
        proposal = await propose_model(
            provider=v.provider,
            prompt=v.prompt,
            version=v.draft,
            encryption_key=v.encryption_key,
            history=v.history,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc
    v.via = _provider_label(v.provider)
    v.llm_ms = proposal.duration_ms
    usage = proposal.usage
    if isinstance(proposal, Clarification):
        await _clarify_event(ctx, v, question=proposal.question, usage=usage, duration_ms=proposal.duration_ms)
        ctx.step.tokens_in, ctx.step.tokens_out = usage.input_tokens, usage.output_tokens
        raise NeedsInput(question=proposal.question, options=list(proposal.options))
    v.proposal = proposal
    if proposal.summary:
        await ctx.emit("reasoning", {"text": proposal.summary})
    n, e = len(proposal.node_types), len(proposal.edge_types)
    return Out(
        detail=f"proposed {n} node type{'' if n == 1 else 's'} · {e} edge type{'' if e == 1 else 's'}",
        output={
            "node_types": [t["name"] for t in proposal.node_types],
            "edge_types": [t["name"] for t in proposal.edge_types],
            "summary": proposal.summary,
            **_exchange(proposal),
        },
        tokens_in=usage.input_tokens,
        tokens_out=usage.output_tokens,
    )


def _vocabulary(envelope) -> list[dict]:
    """What this envelope lets the planner name, as the catalogue declares it.

    The allow-list narrows; the declaration describes. Handing the model both
    at once is what makes ``requires`` something it drafts *with* rather than
    something it is refused by (docs/for-developers/orchestration.md §0.6).
    """
    from invana.runtime.catalogue import CATALOGUE

    return [
        {"key": key, "requires": list(entry.requires), "outputs": {k: str(t) for k, t in entry.outputs.items()}}
        for key, entry in CATALOGUE.items()
        if key in envelope.allow
    ]


# ── Shared by the two entries that may ask back ──────────────────────────────


async def _options(ctx: TaskContext, v: RunVars, clarification: Clarification) -> list[str]:
    return await ground_options(
        ctx.db,
        graph=v.graph,
        manager=ctx.manager,
        options_query=clarification.options_query,
        fallback=list(clarification.options),
        actor_id=v.actor_id,
        session_id=v.sess.id if v.sess else None,
        timeout_s=v.timeout_s,
    )


async def _clarify_event(ctx: TaskContext, v: RunVars, *, question: str, usage, duration_ms: float) -> None:
    assert v.provider is not None
    await emit_event(
        ctx.db,
        action=actions.LLM_TRANSLATE,
        target_kind=actions.TARGET_SESSION,
        target_id=v.sess.id,
        graph_id=v.graph.id,
        actor_id=v.actor_id,
        details={
            "provider": v.provider.provider.value,
            "model_id": v.provider.model_id,
            "action": "clarify",
            "question": question,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "duration_ms": round(duration_ms),
        },
        trace_id=current_trace_id(),
    )


# ── The declaration ──────────────────────────────────────────────────────────
#
# `question` and `options` are declared because a clarification writes them to
# the step row and Studio reads them: an output a surface consumes is an API
# whether or not a plan binds it.

ENTRIES = build(
    Entry(
        key="understand_intent",
        bound=Bound.llm,
        run=understand_intent,
        outputs={
            "kind": Type.str_,
            "summary": Type.str_,
            "refs": Type.list_,
            "expects": Type.list_,
            "confidence": Type.float_,
            "question": Type.str_,
            "options": Type.list_,
        },
    ),
    Entry(
        key="plan_workflow",
        bound=Bound.llm,
        run=plan_workflow,
        outputs={"source": Type.str_, "steps": Type.list_, "rationale": Type.str_},
    ),
    Entry(
        key="translate_thought",
        bound=Bound.llm,
        run=translate_thought,
        args={"ask": Arg(Type.str_)},
        outputs={
            "query": Type.str_,
            "language": Type.str_,
            "rationale": Type.str_,
            "ask": Type.str_,
            "question": Type.str_,
            "options": Type.list_,
        },
    ),
    Entry(
        key="propose_model",
        bound=Bound.llm,
        run=propose_model_task,
        outputs={"node_types": Type.list_, "edge_types": Type.list_, "summary": Type.str_},
        requires=("understand_ask",),
    ),
)
