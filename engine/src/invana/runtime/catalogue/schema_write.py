"""Bound: ``schema_write`` — the entries that touch a model draft
(docs/for-developers/orchestration.md §0.6).

``understand_ask`` binds the draft this run edits; ``validate_proposal`` checks
referential integrity and reconciles the proposal into it. Both write to the
**draft**, never to the bound graph database — that is a different bound and a
different entry.

**This module still reaches three apps** (`llm` · `modeller` · `sessions`),
which is more than an entry-as-a-view may. The span is named in
`tests/golden/test_catalogue.py`'s ``SPANS_ALLOWED`` and closes when
``reconcile_proposal`` moves to an ``apps/modeller`` manager
(docs/for-developers/building-engine/task-model-migration.md § 6.3).
"""

from __future__ import annotations

from invana.apps.llm import LLMError
from invana.apps.llm.propose import validate_proposal
from invana.apps.modeller.store import ModelStore
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.reconcile import reconcile_proposal
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event
from invana.runtime.catalogue.contract import (
    Out,
    RunVars,
    TaskContext,
    TaskFailure,
    _plural,
    _provider_label,
)
from invana.runtime.catalogue.registry import Bound, Entry, Type, build


async def understand_ask(ctx: TaskContext, v: RunVars) -> Out:
    """Resolve the modeller draft and the turns to replay (docs/for-developers/modules/ask/spec.md)."""
    assert v.provider is not None
    v.model, v.draft = await SessionManager()._ensure_model_and_draft(
        ctx.db, sess=v.sess, graph=v.graph, prompt=v.prompt
    )
    turns = len(v.history) // 2
    return Out(
        detail=f"{_provider_label(v.provider)} · draft of {v.model.name} · {_plural(turns, 'prior turn')}",
        input={"prompt": v.prompt, "model_id": v.model.id, "draft_version_id": v.draft.id, "context_turns": turns},
        output={"model_id": v.model.id, "draft_version_id": v.draft.id},
    )


async def validate_proposal_task(ctx: TaskContext, v: RunVars) -> Out:
    """Referential integrity before any draft mutation (docs/for-developers/modules/ask/spec.md), then reconcile into
    the draft."""
    assert v.proposal is not None and v.draft is not None and v.model is not None and v.provider is not None
    existing = {nt.name for nt in v.draft.node_types}
    try:
        validate_proposal(v.proposal, existing_node_type_names=existing)
    except LLMError as exc:
        raise TaskFailure(
            cls="repairable", cause="proposal_invalid", message=exc.message, short="proposal rejected", raw=exc.message
        ) from exc
    v.counts = await reconcile_proposal(ctx.db, store=ModelStore(), version=v.draft, proposal=v.proposal)
    await emit_event(
        ctx.db,
        action=actions.MODEL_GENERATE,
        target_kind=actions.TARGET_SESSION,
        target_id=v.sess.id,
        graph_id=v.graph.id,
        actor_id=v.actor_id,
        details={
            "provider": v.provider.provider.value,
            "model_id": v.provider.model_id,
            "model_id_target": v.model.id,
            "node_type_count": v.counts["node_types"],
            "edge_type_count": v.counts["edge_types"],
            "property_key_count": v.counts["property_keys"],
            "input_tokens": v.proposal.usage.input_tokens,
            "output_tokens": v.proposal.usage.output_tokens,
            "latency_ms": round(v.proposal.duration_ms),
        },
        trace_id=current_trace_id(),
    )
    c = v.counts
    added = [
        f"{c[k]} {label}{'' if c[k] == 1 else 's'}"
        for k, label in (("node_types", "node type"), ("edge_types", "edge type"), ("property_keys", "property key"))
        if c[k]
    ]
    return Out(
        detail=("added " + ", ".join(added)) if added else "no new types · refined existing ones",
        output={"counts": c, "draft_version_id": v.draft.id},
    )


ENTRIES = build(
    Entry(
        key="understand_ask",
        summary="Resolve the modeller draft and the turns to replay.",
        bound=Bound.schema_write,
        run=understand_ask,
        outputs={"model_id": Type.str_, "draft_version_id": Type.str_},
    ),
    Entry(
        key="validate_proposal",
        summary="Check a proposed model change for referential integrity, then stage it.",
        bound=Bound.schema_write,
        run=validate_proposal_task,
        outputs={"counts": Type.obj, "draft_version_id": Type.str_},
        requires=("propose_model",),
    ),
)
