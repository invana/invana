"""The ``nl.understand`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm import LLMError
from invana.apps.llm.grounding import listed_types, render_rules, render_skills
from invana.apps.llm.intent import Conversed, OutOfScope, understand
from invana.apps.llm.translate import Clarification
from invana.plugins.core.llm.shared import _askable, _exchange, _options
from invana.plugins.sdk.context import (
    Out,
    RunVars,
    TaskContext,
    _provider_label,
    _report_ids,
    cited_rule_version_ids,
    close_model,
    offered_rule_version_ids,
    offered_skill_version_ids,
    open_model,
    prompt_lens,
)
from invana.plugins.sdk.errors import CannotAnswer, Converse, NeedsInput, TaskFailure


async def nl_understand(ctx: TaskContext, v: RunVars) -> Out:
    """What the ask means here — before a single character of query is written.

    Three outcomes, and the two that are not "understood" are the point of the
    step existing: a clarification settles *before* a plan is made, and
    *cannot answer* becomes a judgement about the graph's boundary rather than
    something discovered after an empty result.
    Small talk is a fourth: it is conversed with, never refused (NL12).
    """
    assert v.provider is not None
    crossing = await open_model(ctx, v, grounding=v.global_model)
    ctx.step.skills_offered = offered_skill_version_ids(v)
    ctx.step.rules_offered = offered_rule_version_ids(v)
    await ctx.progress(f"{_provider_label(v.provider)} · reading the ask against the model")
    lens = await prompt_lens(ctx, v)
    try:
        outcome = await understand(
            provider=v.provider,
            prompt=v.prompt,
            version=v.global_model,
            encryption_key=v.encryption_key,
            instructions=v.instructions,
            # Understand is a step whose words a person reads — its question
            # and its reason — so it takes the voice (soul.md § What reads the
            # soul). Translate, beside it, takes no such argument (SO2).
            voice=v.soul,
            skills=render_skills(v.skills),
            rules=render_rules(v.rules),
            history=crossing.history(v.history),
            may_send=crossing.may_send,
            lens=lens,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc

    v.via = _provider_label(v.provider)
    v.llm_ms = (v.llm_ms or 0) + outcome.duration_ms
    usage = outcome.usage
    await close_model(ctx, v, crossing, usage=usage, duration_ms=outcome.duration_ms)

    if isinstance(outcome, OutOfScope):
        # The run **succeeds** — "I can't answer that" is an outcome, not
        # a failure (promise #4). The plan never happens, and the trace says why.
        v.summary = outcome.reason
        await ctx.emit("cannot_answer", {"reason": outcome.reason, "stage": ctx.step.task_key})
        ctx.step.tokens_in = usage.input_tokens if usage else None
        ctx.step.tokens_out = usage.output_tokens if usage else None
        raise CannotAnswer(reason=outcome.reason, exchange=_exchange(outcome))

    if isinstance(outcome, Conversed):
        # Small talk — replied to in the agent's voice, never refused (NL12).
        # Like a cannot-answer the run succeeds and no plan is made; unlike
        # one it claims nothing about the graph, so it emits nothing.
        v.summary = outcome.reply
        ctx.step.tokens_in = usage.input_tokens if usage else None
        ctx.step.tokens_out = usage.output_tokens if usage else None
        listed = listed_types(v.global_model, may_send=crossing.may_send, lens=lens)
        options = await _askable(ctx, v, outcome.choices, listed)
        raise Converse(reply=outcome.reply, options=options, exchange=_exchange(outcome))

    if isinstance(outcome, Clarification):
        options, descriptions = await _options(ctx, v, outcome)
        ctx.step.tokens_in = usage.input_tokens if usage else None
        ctx.step.tokens_out = usage.output_tokens if usage else None
        ctx.step.output = {
            "question": outcome.question,
            "options": options,
            "option_descriptions": descriptions,
            **_exchange(outcome),
        }
        raise NeedsInput(question=outcome.question, options=options, descriptions=descriptions)

    v.intent = outcome
    ctx.step.skills_applied = _report_ids(v, outcome.skills_applied)
    ctx.step.rules_cited = cited_rule_version_ids(v, outcome.rules_cited)
    refs = ", ".join(outcome.refs[:4])
    return Out(
        detail=f"{outcome.kind.replace('_', ' ')}" + (f" · {refs}" if refs else ""),
        input={"prompt": v.prompt, "answering": v.answering, "model": v.via},
        output={**outcome.as_dict(), **_exchange(outcome)},
        tokens_in=usage.input_tokens if usage else None,
        tokens_out=usage.output_tokens if usage else None,
    )


run = nl_understand
