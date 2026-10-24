"""The ``data.bundle.check`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from pathlib import Path

from invana.plugins.core.ingest import bundle
from invana.plugins.core.ingest.shared import _root
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


async def data_bundle_check(ctx: TaskContext, v: RunVars) -> Out:
    """Resolve a bundle's manifest against its files, before anything is written.

    The datasets it returns are what `bundle-import@1` fans out over — the
    manifest already declares which belong together, and asking for a second
    list would be a second source of truth (LD12 · C1).
    """
    root = _root(ctx, v)
    try:
        report = bundle.check(Path(root))
    except bundle.BundleError as exc:
        raise TaskFailure(
            cls="blocked", cause="bad_bundle", message=str(exc), short="bundle rejected", raw=str(exc)
        ) from exc
    datasets = [d.name for d in report.datasets]
    findings = [{"dataset": d.name, "check": f.check, "detail": f.detail} for d in report.datasets for f in d.findings]
    ctx.artifact("manifest.json", direction="read", summary=f"{len(datasets)} dataset(s)")
    for dataset in report.datasets:
        ctx.artifact(dataset.name, direction="read", summary=f"{len(dataset.findings)} finding(s)")
    return Out(
        detail=f"{len(datasets)} folder{'' if len(datasets) == 1 else 's'} · {len(findings)} finding(s)",
        input={"root": root},
        output={"datasets": datasets, "findings": findings, "passed": report.passed},
    )


run = data_bundle_check
