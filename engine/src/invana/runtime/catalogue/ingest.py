"""Bound: ``ingest`` — the entries that read a source and decide what may land
(docs/for-developers/orchestration.md §0.6).

**The keys are the ones already stored** on every load's nodes —
`validate_records` is not renamed to `import_dataset` (§6.4).

Reading a folder is `ingest`, not `graph_read`: nothing here touches the bound
database. What lands is `graph_write`, and it is a separate ceiling for exactly
that reason.

**The bodies are here, not one import away** (the-runtime-package.md § 4a).
"""

from __future__ import annotations

import json
from pathlib import Path

from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.validator import SchemaValidator
from invana.runtime.catalogue import bundle
from invana.runtime.catalogue.contract import Out, RunVars, TaskContext, TaskFailure
from invana.runtime.catalogue.records import (
    _read_records,
    _validate_edges,
    _validate_nodes,
    group_report,
)
from invana.runtime.catalogue.registry import Arg, Bound, Entry, Type, build

_store = ModelStore()


def _root(ctx: TaskContext, v: RunVars) -> str:
    """Where the files are — the step's own arg, else what the run was opened on."""
    bound = str((ctx.step.args or {}).get("root") or "")
    if bound:
        return bound
    if v.load is not None and v.load.root:
        return v.load.root
    raise TaskFailure(
        cls="blocked",
        cause="no_source",
        message="This step has no source folder to read.",
        short="no source",
    )


def _load(v: RunVars):
    if v.load is None:
        raise TaskFailure(
            cls="blocked",
            cause="not_a_load",
            message="This step belongs to a load, and this run is not one.",
            short="not a load",
        )
    return v.load


async def check_bundle(ctx: TaskContext, v: RunVars) -> Out:
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


async def validate_records(ctx: TaskContext, v: RunVars) -> Out:
    """Check every record against the model's published version (LD2).

    Per record, never per file: one bad row does not fail a load, and nothing is
    dropped in silence. The rejections ride the run's report, which the run
    detail shows.
    """
    load = _load(v)
    load.root = load.root or _root(ctx, v)
    root = Path(load.root)

    # Optional: it carries identity keys, not a schema. Without one, identity
    # falls back to `id`.
    model_json_path = root / "model.json"
    load.model_json = json.loads(model_json_path.read_text()) if model_json_path.is_file() else {}

    node_records = _read_records(root / "nodes")
    edge_records = _read_records(root / "edges")
    load.total = sum(len(r) for r in node_records.values()) + sum(len(r) for r in edge_records.values())
    # The files this step read, listed as it read them — the Artifacts panel on
    # its dashboard is this list and nothing else (SR38). `model.json` is one of
    # them when the folder ships one: a reader asking *what did identity come
    # from* is asking about a file.
    if load.model_json:
        ctx.artifact("model.json", direction="read", summary="identity keys")
    for kind, records in (("nodes", node_records), ("edges", edge_records)):
        for name, rows in records.items():
            ctx.artifact(f"{kind}/{name}.json", direction="read", summary=f"{len(rows)} records")

    version = await _store.get_version(ctx.db, load.version_id)
    model = await _store.get_graph_model(ctx.db, load.model_id)
    if version is None or model is None:
        raise TaskFailure(
            cls="blocked",
            cause="cannot_validate",
            message="The model this load was opened against is gone.",
            short="cannot validate",
        )

    validator = SchemaValidator()
    validator.load(version, validation_mode=model.validation_mode)
    known = {nt.name for nt in version.node_types}
    endpoints = {
        et.name: (set(et.source_node_types or []), set(et.target_node_types or [])) for et in version.edge_types
    }

    load.valid_nodes = _validate_nodes(validator, node_records, known, load.report)
    node_ids = {str(rec["id"]) for records in load.valid_nodes.values() for rec in records}
    load.valid_edges, load.deferred = _validate_edges(edge_records, endpoints, node_ids, load.report)

    reported = len(load.report)
    return Out(
        detail=f"against {model.name}@v{version.version} · {reported} reported",
        input={"root": load.root, "model": model.name},
        output={"total": load.total, "reported": reported, "model": model.name, "version": version.version},
    )


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


ENTRIES = build(
    Entry(
        key="check_bundle",
        bound=Bound.ingest,
        run=check_bundle,
        args={"root": Arg(Type.str_)},
        outputs={"datasets": Type.list_, "findings": Type.list_, "passed": Type.bool_},
    ),
    Entry(
        key="snapshot_model",
        bound=Bound.ingest,
        run=snapshot_model,
        args={"model": Arg(Type.str_)},
        outputs={
            "model_id": Type.str_,
            "version_id": Type.str_,
            "version": Type.int_,
            "reported": Type.int_,
            # Declared because a reader consumes it — the same reason
            # `question` and `options` are declared (§ 6.1). It is the grouped
            # report, never the raw rejections: a plan binds what a person can
            # see in the trace.
            "groups": Type.list_,
        },
        requires=("write_graph",),
    ),
    Entry(
        key="validate_records",
        bound=Bound.ingest,
        run=validate_records,
        args={"root": Arg(Type.str_), "model": Arg(Type.str_)},
        outputs={"total": Type.int_, "reported": Type.int_, "model": Type.str_, "version": Type.int_},
    ),
)
