"""The ``translate_thought`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm import LLMError, QueryNotReadOnlyError
from invana.apps.llm.grounding import render_rules, render_skills
from invana.apps.llm.translate import Clarification, nl_to_query
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.plugins.core.llm.shared import _clarify_event, _exchange, _options
from invana.plugins.sdk.context import (
    Out,
    RunVars,
    TaskContext,
    _line_count,
    _provider_label,
    _report_ids,
    cited_rule_version_ids,
    close_model,
    offered_rule_version_ids,
    offered_skill_version_ids,
    open_model,
    prompt_lens,
    query_language_for,
)
from invana.plugins.sdk.errors import NeedsInput, TaskFailure


async def translate_thought(ctx: TaskContext, v: RunVars) -> Out:
    """NL → grounded query via the bound provider (docs/for-developers/modules/ask/features/ask-in-natural-language.md);
    asks back when ambiguous (docs/for-developers/modules/ask/features/clarifying-questions.md).

    A compound plan runs this step more than once, each time with its own
    ``ask`` — one sub-question per step, so *Translate A* and *Translate B* are
    two rows a reader can tell apart rather than one row that did two things.
    """
    assert v.provider is not None
    crossing = await open_model(ctx, v, grounding=v.global_model)
    ask = str((ctx.step.args or {}).get("ask") or "").strip() or v.prompt
    ctx.step.skills_offered = offered_skill_version_ids(v)
    ctx.step.rules_offered = offered_rule_version_ids(v)
    turns = len(v.history)
    await ctx.progress(f"{_provider_label(v.provider)} · reading {turns} prior turn{'' if turns == 1 else 's'}")
    language = await query_language_for(ctx, v, strict=True)
    try:
        generated = await nl_to_query(
            provider=v.provider,
            prompt=ask,
            language=language,
            version=v.global_model,
            encryption_key=v.encryption_key,
            skills=render_skills(v.skills),
            rules=render_rules(v.rules),
            instructions=v.instructions,
            history=crossing.history(v.history),
            may_send=crossing.may_send,
            lens=await prompt_lens(ctx, v),
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
    await close_model(ctx, v, crossing, usage=usage, duration_ms=generated.duration_ms)

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
    ctx.step.rules_cited = cited_rule_version_ids(v, generated.rules_cited)
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


run = translate_thought
