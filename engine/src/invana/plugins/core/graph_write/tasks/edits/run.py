"""The ``graph.write.edits`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from pydantic import ValidationError as ShapeError

from invana.apps.modeller.managers.data_edit import DataEditManager, EditFailed
from invana.apps.modeller.schemas import DataEditBatch
from invana.core.errors import ConflictError, ValidationError
from invana.plugins.core.ingest.records import LoadRefused, connector_for
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import TaskFailure


async def graph_write_edits(ctx: TaskContext, v: RunVars) -> Out:
    """Write the edits a board saved, in order, after checking them against the model again.

    The route checked the batch before opening this run; the check runs again
    here because the model can be published between the two, and a run is the
    record of what was written against which version. The model's version is
    the write target the Graph's guardrails are asked about.
    """
    manager = DataEditManager()
    edits = list((ctx.step.args or {}).get("edits") or [])
    try:
        batch = DataEditBatch.model_validate({"edits": edits})
    except ShapeError as exc:
        raise TaskFailure(cls="blocked", cause="bad_batch", message=str(exc), short="bad batch") from exc
    try:
        index = await manager.model_index(ctx.db, (ctx.step.args or {}).get("model_id") or None)
        checked = manager.check_batch(batch, index)
    except (ConflictError, ValidationError) as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise TaskFailure(
            cls="blocked",
            cause=str(detail.get("error") or "not_in_model"),
            message=str(detail.get("message") or detail),
            short="refused by the model",
        ) from exc

    writes = Writes(ctx, v)
    await writes.admit(index.version_id)
    await ctx.progress(f"writing {len(checked)} edit{'s' if len(checked) != 1 else ''}")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc
    try:
        await connector.connect()
        ids, applied = await manager.apply_edits(connector, checked)
    except EditFailed as exc:
        raise TaskFailure(
            cls="failed" if exc.code == "write_failed" else "blocked",
            cause=exc.code,
            message=f"{exc} {exc.applied} of {len(checked)} edits were written before it.",
            short=exc.code.replace("_", " "),
        ) from exc
    finally:
        await connector.disconnect()

    nodes = sum(1 for e in checked if e.op in ("add_node", "update_node", "delete_node"))
    writes.wrote(index.version_id, nodes=nodes, edges=len(checked) - nodes)
    await writes.close()
    return Out(
        detail=f"{applied} edit{'s' if applied != 1 else ''} written",
        input={"edits": len(checked)},
        output={"applied": applied, "ids": ids},
    )


run = graph_write_edits
