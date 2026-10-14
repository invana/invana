"""The ``commit_stitches`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.modeller.managers import CountSnapshotManager
from invana.plugins.core.graph_write.shared import _run_id, logger
from invana.plugins.core.ingest import stitching
from invana.plugins.core.ingest.records import LoadRefused, connector_for
from invana.plugins.sdk.context import Out, RunVars, TaskContext, Writes
from invana.plugins.sdk.errors import TaskFailure


async def commit_stitches(ctx: TaskContext, v: RunVars) -> Out:
    """Flip the staged set to active and run every stitch in it (ST44)."""
    await ctx.progress("writing stitched edges")
    try:
        connector = await connector_for(ctx.db, ctx.step.graph_id)
    except LoadRefused as exc:
        raise TaskFailure(
            cls="blocked", cause="cannot_write", message=str(exc), short="cannot write", raw=str(exc)
        ) from exc
    writes = Writes(ctx, v)

    async def admit(link) -> bool:
        return all(
            [
                await writes.admit(link.source_version_id, fatal=False),
                await writes.admit(link.target_version_id, fatal=False),
            ]
        )

    committed = await stitching.commit_stitches(ctx.db, graph_id=ctx.step.graph_id, connector=connector, admit=admit)
    by_id = {link.id: link for link in committed.links}
    for done in [*committed.solved, *committed.loaded]:
        link = by_id.get(done.link_id)
        if link is not None and done.written:
            writes.wrote(link.source_version_id, edges=done.written)
            if link.target_version_id != link.source_version_id:
                writes.wrote(link.target_version_id, edges=done.written)
    await writes.close()
    if committed.links:
        # What the commit wrote is a point on the Growth line, named by its run (MP30).
        try:
            await connector.connect()
            await CountSnapshotManager().take(
                ctx.db,
                graph_id=ctx.step.graph_id,
                connector=connector,
                source="stitch_commit",
                source_id=_run_id(ctx),
                degrees=False,
            )
        except Exception:
            logger.warning("No count after stitch commit %s — the database did not answer", _run_id(ctx), exc_info=True)
        finally:
            await connector.disconnect()
    return Out(
        detail=f"{committed.written} written · {committed.rejected} rejected",
        input={},
        output={
            "written": committed.written,
            "rejected": committed.rejected,
            # One row per stitch, so a drawer or a terminal can say what each one
            # wrote — a zero is a verdict, and a refusal names why (ST53).
            "links": [
                {
                    "link_id": done.link_id,
                    "rule": getattr(done, "rule", "") or "",
                    "edge_type": done.edge_type,
                    "written": done.written,
                    "skipped": done.skipped,
                }
                for done in [*committed.solved, *committed.loaded]
            ],
        },
    )


run = commit_stitches
