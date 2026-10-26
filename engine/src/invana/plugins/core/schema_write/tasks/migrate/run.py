"""The ``model.migrate`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.datasets.managers import DatasetManager
from invana.apps.modeller.managers import PublishManager
from invana.graph.connectors.base.exceptions import ConnectorError
from invana.plugins.core.graph_read.shared import _connector
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import CannotAnswer, TaskFailure


async def model_migrate(ctx: TaskContext, v: RunVars) -> Out:
    """Scan what a breaking model change touches; applying an approved review, publish it.

    The model's published version is the participant: the guardrails must
    **admit** it before a record is read, and only ``allow`` admits — a scan over
    a slice would undercount what the change touches.
    The scan reads through the connector's data reader and writes no record.
    """
    args = ctx.step.args or {}
    apply = bool(args.get("apply"))
    base_version_id = args.get("base_version_id") or None
    publishing = PublishManager()
    writes = Writes(ctx, v)
    try:
        await writes.admit(base_version_id)
    except CannotAnswer as exc:
        await publishing.note_refusal(ctx.db, review_id=args.get("review_id") or None, reason=exc.reason)
        raise
    await ctx.progress("publishing the reviewed change" if apply else "scanning what the change touches")
    connector = await _connector(ctx, v)
    model_id = str(args.get("model_id") or "")
    bound = await DatasetManager().bound_to_model(ctx.db, graph_id=v.graph.id, model_id=model_id) if apply else []
    try:
        out = await publishing.migrate(
            ctx.db,
            reader=connector.data_reader,
            model_id=model_id,
            version_id=str(args.get("version_id") or ""),
            base_version_id=base_version_id,
            review_id=args.get("review_id") or None,
            apply=apply,
            actor_id=v.actor_id,
            bound=bound,
        )
    except ConnectorError as exc:
        raise TaskFailure(
            cls="failed", cause="graph_error", message=f"The graph could not be scanned: {exc}", raw=str(exc)
        ) from exc
    await writes.close()
    preview = out["preview"]
    scanned = f"{preview.get('affected', 0)} affected · {preview.get('would_fail', 0)} would fail"
    published = f" · published {out['published_version']}" if out["published_version"] else ""
    return Out(
        detail=f"{out['classification']} · {scanned}{published}",
        input={k: args.get(k) for k in ("model_id", "version_id", "base_version_id", "review_id", "apply")},
        output=out,
    )


run = model_migrate
