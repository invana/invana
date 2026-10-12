"""The ``snapshot_model`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.core.ingest.records import group_report
from invana.plugins.core.ingest.shared import _load, _store
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


async def snapshot_model(ctx: TaskContext, v: RunVars) -> Out:
    """Record what this load was checked against, and what landed (LD8).

    **It spends `ingest`, not `schema_write`, because it writes no schema.** It
    pins the version this load *validated against* — rather than reading the
    active one again, so a model published mid-load cannot change what the trace
    claims. An agent allowed to load may stamp what it loaded; changing the
    model itself is a different ceiling.

    **What landed is reported, not stored.** `write_graph` and `stitch` already
    declare their counts, so a second copy on a row beside them would be a fact
    with two homes and no rule for which is right (§ 6.7).
    """
    load = _load(v)
    version = await _store.get_version(ctx.db, load.version_id)
    if version is None:
        raise TaskFailure(
            cls="blocked",
            cause="no_version",
            message="The model this load was opened against is gone.",
            short="no version",
        )

    # **What landed includes what did not.** The rejections accumulate across
    # every stage — a bad property is found while validating, an endpoint that
    # resolves nowhere while stitching — so the grouped report is assembled by
    # the step that records the outcome, not by the one that found the first of
    # them. Grouped, because one bad column is one line and not four thousand.
    nodes = sum((load.counts.get("nodes") or {}).values())
    edges = sum((load.counts.get("edges") or {}).values())
    return Out(
        detail=f"v{version.version} · {nodes} node(s) / {edges} edge(s)",
        input={},
        output={
            "model_id": load.model_id,
            "version_id": load.version_id,
            "version": version.version,
            "reported": len(load.report),
            "groups": group_report(load.report),
        },
    )


run = snapshot_model
