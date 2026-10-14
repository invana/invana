"""The ``propose_model`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm import LLMError
from invana.apps.llm.propose import propose_model
from invana.apps.llm.translate import Clarification
from invana.plugins.core.llm.shared import _clarify_event, _exchange
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _provider_label, close_model, open_model
from invana.plugins.sdk.errors import NeedsInput, TaskFailure


async def propose_model_task(ctx: TaskContext, v: RunVars) -> Out:
    """Node and edge types for the described change, staged on the draft."""
    assert v.provider is not None and v.draft is not None
    crossing = await open_model(ctx, v, grounding=v.draft)
    await ctx.progress(f"{_provider_label(v.provider)} · proposing node and edge types")
    try:
        proposal = await propose_model(
            provider=v.provider,
            prompt=v.prompt,
            version=v.draft,
            encryption_key=v.encryption_key,
            history=crossing.history(v.history),
            may_send=crossing.may_send,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc
    v.via = _provider_label(v.provider)
    v.llm_ms = proposal.duration_ms
    usage = proposal.usage
    await close_model(ctx, v, crossing, usage=usage, duration_ms=proposal.duration_ms)
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


run = propose_model_task
