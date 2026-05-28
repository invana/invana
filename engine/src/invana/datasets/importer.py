"""Dataset import pipeline (RFC-020, slice 1).

`import_dataset(...)` runs the whole flow synchronously:

  model.json  → derive/version a GraphModel (reuse SchemaImporter + Versioner)
  records     → validate against the active version (SchemaValidator)
  ingest      → MERGE nodes/edges into the bound graph DB (identity stitch)

Slice 1 targets the **Cypher** backends (Neo4j / Memgraph) — node/edge writes are
generated Cypher `MERGE` keyed by identity. Gremlin ingest + MinIO + async jobs are
follow-ups (see RFC-020 § Slice plan).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.datasets.models import Dataset, ImportJob
from invana.events import actions as event_actions
from invana.events.models import ActorType
from invana.events.services import emit_event
from invana.graphs import services
from invana.graphs.manager import _build_connector
from invana.modeller.json_io import SchemaImporter
from invana.modeller.schemas import (
    EdgeTypeCreate,
    NodeTypeCreate,
    PropertyKeyCreate,
    SchemaExport,
    TypePropertyMappingCreate,
)
from invana.modeller.store import ModelStore
from invana.modeller.validator import SchemaValidator
from invana.modeller.versioner import Versioner
from invana.settings import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.graph.connectors.base.connector import BaseConnector

_DEFAULT_IDENTITY = ["id"]


class DatasetImportError(Exception):
    """Raised when a dataset can't be imported (bad model.json, no connection, …)."""


# ---------------------------------------------------------------------------
# model.json → schema
# ---------------------------------------------------------------------------


def _model_json_to_schema_export(model_json: dict, name: str) -> SchemaExport:
    """Convert the on-disk model.json into a SchemaExport the modeller can import.

    model.json declares properties *per type*; the modeller uses *global* property
    keys + per-type mappings, so we union property names into keys first.
    """
    nodes = model_json.get("nodes", {}) or {}
    edges = model_json.get("edges", {}) or {}

    # Union of property (name → type) across all node + edge types.
    prop_types: dict[str, str] = {}
    for spec in (*nodes.values(), *edges.values()):
        for pname, pdef in (spec.get("properties", {}) or {}).items():
            prop_types.setdefault(pname, (pdef or {}).get("type", "string"))

    property_keys = [PropertyKeyCreate(name=n, type=t) for n, t in prop_types.items()]

    node_types = [
        NodeTypeCreate(
            name=type_name,
            property_mappings=[TypePropertyMappingCreate(property_key=p) for p in (spec.get("properties", {}) or {})],
        )
        for type_name, spec in nodes.items()
    ]

    edge_types = [
        EdgeTypeCreate(
            name=type_name,
            source_node_types=list(spec.get("from", []) or []),
            target_node_types=list(spec.get("to", []) or []),
            multiplicity=spec.get("multiplicity", "MULTI"),
            property_mappings=[TypePropertyMappingCreate(property_key=p) for p in (spec.get("properties", {}) or {})],
        )
        for type_name, spec in edges.items()
    ]

    return SchemaExport(
        schema_name=name,
        property_keys=property_keys,
        node_types=node_types,
        edge_types=edge_types,
    )


def _identity_keys(node_spec: dict) -> list[str]:
    keys = node_spec.get("identity")
    return list(keys) if keys else list(_DEFAULT_IDENTITY)


# ---------------------------------------------------------------------------
# Cypher generation (identity-keyed MERGE)
# ---------------------------------------------------------------------------


def _label(name: str) -> str:
    """Backtick-quote a Cypher label/rel-type; reject backticks (injection guard)."""
    if "`" in name:
        raise DatasetImportError(f"Invalid type name: {name!r}")
    return f"`{name}`"


def _provenance(dataset_id: str, record_id: str, job_id: str) -> dict:
    return {"_inv_dataset_id": dataset_id, "_inv_record_id": record_id, "_inv_job_id": job_id}


def _log(logs: list[dict], level: str, stage: str, message: str) -> None:
    """Append a structured log line to *logs* (persisted on ``ImportJob.logs``)."""
    logs.append({"ts": datetime.now(UTC).isoformat(), "level": level, "stage": stage, "message": message})


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


def _read_records(directory: Path) -> dict[str, list[dict]]:
    """Read every <Type>.json in *directory* → {Type: [records]}."""
    out: dict[str, list[dict]] = {}
    if not directory.is_dir():
        return out
    for f in sorted(directory.glob("*.json")):
        out[f.stem] = json.loads(f.read_text())
    return out


async def import_dataset(session: AsyncSession, *, graph_id: str, name: str, path: str | Path) -> ImportJob:
    """Import the dataset at *path* into *graph_id* as model+data named *name*."""
    root = Path(path)
    model_path = root / "model.json"
    if not model_path.is_file():
        raise DatasetImportError(f"No model.json at {model_path}")
    model_json = json.loads(model_path.read_text())
    node_records = _read_records(root / "nodes")
    edge_records = _read_records(root / "edges")

    store = ModelStore()

    # 1. Dataset + ImportJob rows -------------------------------------------------
    dataset = (
        await session.execute(select(Dataset).where(Dataset.graph_id == graph_id, Dataset.name == name))
    ).scalar_one_or_none()
    if dataset is None:
        dataset = Dataset(graph_id=graph_id, name=name, storage_uri=f"file://{root.resolve()}")
        session.add(dataset)
        await session.flush()
    job = ImportJob(dataset_id=dataset.id, status="running", started_at=datetime.now(UTC))
    session.add(job)
    await session.flush()

    report: list[dict] = []
    logs: list[dict] = []
    n_nodes = sum(len(r) for r in node_records.values())
    n_edges = sum(len(r) for r in edge_records.values())
    _log(logs, "info", "register", f"Importing {name!r}: {n_nodes} node + {n_edges} edge record(s)")
    try:
        # 2. Derive / version the GraphModel -------------------------------------
        models = await store.list_graph_models(session, graph_id=graph_id)
        model = next((m for m in models if m.name == name), None)
        if model is None:
            model = await store.create_graph_model(session, name=name, graph_id=graph_id)
        dataset.model_id = model.id

        export = _model_json_to_schema_export(model_json, name)
        version_id = await SchemaImporter(store).import_schema(session, model_id=model.id, data=export)
        active = await Versioner(store).activate(session, version_id=version_id)
        job.model_version_id = active.id
        _log(logs, "info", "model", f"Model {name!r} v{active.version} derived from model.json")

        # 3. Validate records against the active version -------------------------
        version = await store.get_active_version(session, model.id)
        validator = SchemaValidator()
        validator.load(version, validation_mode="permissive")
        valid_nodes, valid_edges = _validate(validator, node_records, edge_records, report)
        _log(logs, "info", "validate", f"Validated {n_nodes + n_edges} record(s) — {len(report)} error(s)")

        # 4. Ingest + stitch into the bound graph DB -----------------------------
        connection = await services.get_graph_connection(session, graph_id=graph_id)
        if connection is None:
            raise DatasetImportError("Graph has no connection — attach one before importing.")
        counts = await _ingest(
            _build_connector(connection, settings.encryption_key),
            dataset_id=dataset.id,
            job_id=job.id,
            model_json=model_json,
            node_records=valid_nodes,
            edge_records=valid_edges,
        )
        node_n = sum(counts["nodes"].values())
        edge_n = sum(counts["edges"].values())
        _log(logs, "info", "ingest", f"Ingested {node_n} node(s) / {edge_n} edge(s) into the graph")

        # 5. Finish ---------------------------------------------------------------
        dataset.record_counts = counts
        job.records_total = n_nodes + n_edges
        job.records_processed = node_n + edge_n
        job.error_count = len(report)
        job.report = {"errors": report}
        job.status = "succeeded"
        _log(logs, "info", "done", "Import succeeded")
    except Exception as exc:
        job.status = "failed"
        job.report = {"errors": report, "fatal": str(exc)}
        _log(logs, "error", "failed", str(exc))
    finally:
        job.finished_at = datetime.now(UTC)
        job.logs = logs
        dataset.last_job_id = job.id
        await emit_event(
            session,
            action=event_actions.DATASET_IMPORT,
            target_kind=event_actions.TARGET_DATASET,
            target_id=dataset.id,
            graph_id=graph_id,
            actor_type=ActorType.system,
            details={"name": name, "status": job.status, "job_id": job.id},
        )
        await session.commit()

    return job


def _validate(
    validator: SchemaValidator,
    node_records: dict[str, list[dict]],
    edge_records: dict[str, list[dict]],
    report: list[dict],
) -> tuple[dict[str, list[dict]], dict[str, list[dict]]]:
    """Validate records; return only the valid ones, appending failures to *report*."""
    valid_nodes: dict[str, list[dict]] = {}
    for type_name, records in node_records.items():
        kept = []
        for i, rec in enumerate(records):
            errors = validator.validate_vertex_create(type_name, rec.get("properties", {}))
            if errors:
                report.extend(
                    {
                        "file": f"nodes/{type_name}.json",
                        "record_index": i,
                        "record_id": rec.get("id"),
                        "message": e.message,
                    }
                    for e in errors
                )
            else:
                kept.append(rec)
        valid_nodes[type_name] = kept

    valid_edges: dict[str, list[dict]] = {}
    for type_name, records in edge_records.items():
        valid_edges[type_name] = records  # edge validation needs endpoint labels — deferred to a later slice
    return valid_nodes, valid_edges


async def _ingest(
    connector: BaseConnector,
    *,
    dataset_id: str,
    job_id: str,
    model_json: dict,
    node_records: dict[str, list[dict]],
    edge_records: dict[str, list[dict]],
) -> dict[str, dict[str, int]]:
    """MERGE nodes (by identity) then edges (by endpoint id) into the graph DB."""
    nodes_spec = model_json.get("nodes", {}) or {}
    counts: dict[str, dict[str, int]] = {"nodes": {}, "edges": {}}
    await connector.connect()
    try:
        for type_name, records in node_records.items():
            identity = _identity_keys(nodes_spec.get(type_name, {}))
            n = 0
            for rec in records:
                props = {"id": rec["id"], **(rec.get("properties", {}) or {})}
                key = {k: props.get(k) for k in identity}
                key_frag = ", ".join(f"{k}: $key_{k}" for k in identity)
                query = f"MERGE (n:{_label(type_name)} {{{key_frag}}}) SET n += $props, n += $prov"
                params = {"props": props, "prov": _provenance(dataset_id, str(rec["id"]), job_id)}
                params.update({f"key_{k}": v for k, v in key.items()})
                await connector.execute(query, params)
                n += 1
            counts["nodes"][type_name] = n

        for type_name, records in edge_records.items():
            n = 0
            for rec in records:
                props = {**(rec.get("properties", {}) or {})}
                query = (
                    "MATCH (a {id: $from_id}), (b {id: $to_id}) "
                    f"MERGE (a)-[r:{_label(type_name)}]->(b) SET r += $props, r += $prov"
                )
                params = {
                    "from_id": rec["from"],
                    "to_id": rec["to"],
                    "props": props,
                    "prov": _provenance(dataset_id, str(rec.get("id", "")), job_id),
                }
                await connector.execute(query, params)
                n += 1
            counts["edges"][type_name] = n
    finally:
        await connector.disconnect()
    return counts
