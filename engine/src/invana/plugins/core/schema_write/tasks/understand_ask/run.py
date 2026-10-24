"""The ``model.understand_ask`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.sessions.managers import SessionManager
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _plural, _provider_label


async def model_understand_ask(ctx: TaskContext, v: RunVars) -> Out:
    """Resolve the modeller draft and the turns to replay (docs/for-developers/modules/ask/spec.md)."""
    assert v.provider is not None
    v.model, v.draft = await SessionManager()._ensure_model_and_draft(
        ctx.db, sess=v.sess, graph=v.graph, prompt=v.prompt
    )
    turns = len(v.history)
    return Out(
        detail=f"{_provider_label(v.provider)} · draft of {v.model.name} · {_plural(turns, 'prior turn')}",
        input={"prompt": v.prompt, "model_id": v.model.id, "draft_version_id": v.draft.id, "context_turns": turns},
        output={"model_id": v.model.id, "draft_version_id": v.draft.id},
    )


run = model_understand_ask
