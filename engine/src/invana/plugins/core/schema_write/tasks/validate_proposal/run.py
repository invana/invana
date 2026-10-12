"""The ``validate_proposal`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm import LLMError
from invana.apps.llm.propose import validate_proposal
from invana.apps.modeller.store import ModelStore
from invana.apps.sessions.reconcile import reconcile_proposal
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


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


run = validate_proposal_task
