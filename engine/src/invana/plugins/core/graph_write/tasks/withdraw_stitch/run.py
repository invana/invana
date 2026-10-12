"""The ``withdraw_stitch`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.core.ingest import stitching
from invana.plugins.core.ingest.records import LoadRefused, connector_for
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import TaskFailure


async def withdraw_stitch(ctx: TaskContext, v: RunVars) -> Out:
    """Withdraw the edges one active stitch wrote, then remove the rule (ST55).

    Both models are the write target, so a guardrail denying either one ends
    the run in *cannot answer* before an edge is deleted — unlike a commit,
    where a refused stitch is committed and skipped (ST53). Keeping the edges
    of a removed rule would leave edges naming a stitch nobody can see.
    """
    link_id = str((ctx.step.args or {}).get("link_id") or "")
    link = await stitching.link_service.get_link(ctx.db, ctx.step.graph_id, link_id) if link_id else None
    if link is None:
        raise TaskFailure(cls="blocked", cause="not_found", message="No such stitch in this Graph.", short="no stitch")
    await ctx.progress("withdrawing stitched edges")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc
    writes = Writes(ctx, v)
    withdrawn = await stitching.withdraw_stitch(
        ctx.db, graph_id=ctx.step.graph_id, link=link, connector=connector, admit=writes.admit
    )
    writes.wrote(link.source_version_id, edges=withdrawn)
    if link.target_version_id != link.source_version_id:
        writes.wrote(link.target_version_id, edges=withdrawn)
    await writes.close()
    return Out(
        detail=f"{withdrawn} edge(s) withdrawn",
        input={"link_id": link_id},
        output={"withdrawn": withdrawn},
    )


run = withdraw_stitch
