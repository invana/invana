"""What the ``llm`` task types share."""

from __future__ import annotations

from invana.apps.llm.clarify import ground_options
from invana.apps.llm.intent import Choice
from invana.apps.llm.translate import Clarification
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.plugins.sdk.context import (
    POOL_GRAPHDB,
    CannotAnswer,
    RunVars,
    TaskContext,
    _give_pool_back,
    _sha,
    close_graph,
    graph_readable,
    open_graph,
    query_language_for,
)


def _event_target(v: RunVars) -> dict:
    """Where a model call's audit event points: the session, else the run.

    A run opened outside a session — a re-run from the Runs page — has no
    thread to point at, so its events land on the run itself.
    """
    if v.sess is not None:
        return {"target_kind": actions.TARGET_SESSION, "target_id": v.sess.id}
    assert v.run is not None
    return {"target_kind": actions.TARGET_THINKING, "target_id": v.run.id}


def _exchange(outcome) -> dict:
    """The prompt and the completion, for the step board's Output band.

    **Deliberately undeclared** (SR42). Declaration is what makes an output
    bindable (`orchestration.md` §0.6), so keeping these two off the entry's
    ``outputs`` is what keeps a plan out of a step's internals — while leaving
    them visible to the person reading the trace, which is who they are for.
    """
    exchange = getattr(outcome, "exchange", None)
    if exchange is None or not (exchange.prompt or exchange.completion):
        return {}
    return {"prompt": exchange.prompt, "completion": exchange.completion}


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


#: The step every data question ends in: an agent whose envelope lacks it can
#: answer nothing, so it is offered nothing to ask (NL14).
_READS_THE_GRAPH = "execute_graph_query"
_MAX_CHOICES = 3


async def _askable(ctx: TaskContext, v: RunVars, choices: list[Choice], listed: frozenset[str]) -> list[str]:
    """The choices after small talk that this run could actually answer (NL14).

    A choice stays only when every type it reads is one the run's world lets it
    read and the model was told of — the same cut the grounding block makes —
    and only while this agent may run a query and this world lets it read the
    graph at all. Anything else is dropped rather than offered and refused:
    none left is a plain reply, which is the honest answer under a world that
    shuts everything.
    """
    if not choices or not listed:
        return []
    if v.envelope is not None and _READS_THE_GRAPH not in v.envelope.allow:
        return []
    if not await graph_readable(ctx, v):
        return []
    kept = [c.ask for c in choices if c.refs and set(c.refs) <= listed]
    return list(dict.fromkeys(kept))[:_MAX_CHOICES]


async def _options(ctx: TaskContext, v: RunVars, clarification: Clarification) -> tuple[list[str], list[str]]:
    """The choices a clarification offers, read under the run's lens, and their descriptions.

    Only the fixed options carry descriptions: values read from the graph are
    their own label.

    The options query crosses ``graph_data`` like every other read the run
    makes: the crossing is opened around it and the touch recorded. A world
    that refuses the read leaves the fixed options, never an ungoverned read.
    """
    fallback = list(clarification.options)
    fixed = (fallback, list(clarification.option_descriptions))
    if not clarification.options_query:
        return fixed
    try:
        crossing = await open_graph(ctx, v)
    except CannotAnswer:
        return fixed
    language = await query_language_for(ctx, v, strict=False)
    options, result = await ground_options(
        ctx.db,
        graph=v.graph,
        manager=ctx.manager,
        options_query=clarification.options_query,
        fallback=fallback,
        actor_id=v.actor_id,
        session_id=v.sess.id if v.sess else None,
        timeout_s=v.timeout_s,
        language=language,
        lens=crossing.lens,
    )
    if result is not None:
        query = clarification.options_query
        digests = result.composed.digests if result.composed else {"generated": _sha(query), "executed": _sha(query)}
        await close_graph(ctx, v, crossing, result=result, digests=digests)
    else:
        # Nothing was read, so there is no touch — but the slot was taken.
        _give_pool_back(v, pool=POOL_GRAPHDB, holder=crossing.pool_holder)
    return fixed if options == fallback else (options, [])


async def _clarify_event(ctx: TaskContext, v: RunVars, *, question: str, usage, duration_ms: float) -> None:
    assert v.provider is not None
    await emit_event(
        ctx.db,
        action=actions.LLM_TRANSLATE,
        **_event_target(v),
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
    )


# ── The declaration ──────────────────────────────────────────────────────────
#
# `question` and `options` are declared because a clarification writes them to
# the step row and Studio reads them: an output a surface consumes is an API
# whether or not a plan binds it.
