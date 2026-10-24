"""The ``data.records.validate`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import json
from pathlib import Path

from invana.apps.modeller.validator import SchemaValidator
from invana.plugins.core.ingest.records import _read_records, _validate_edges, _validate_nodes
from invana.plugins.core.ingest.shared import _load, _root, _store
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure


async def data_records_validate(ctx: TaskContext, v: RunVars) -> Out:
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
    # its board is this list and nothing else (SR38). `model.json` is one of
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


run = data_records_validate
