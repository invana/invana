"""Loading records into a model (docs/for-developers/modules/bring-data-in/features/load-data.md).

Invana is a **destination**. Something else extracts and transforms; what arrives
here is a folder of records that already conforms to a model somebody authored:

    model.json is *not* read as a schema to create — the folder names the model
    it conforms to, and the load validates against that model's active version.

**This module is the work, never the order.** The four acts are catalogue
primitives assembled by `model-import@1`, and the interpreter walks them
(BD7 · § 6.7) — `import_dataset` held that order in code, and it is gone.

Four rules this file exists to keep:

- **`--model` is required and names an authored model** (LD1). Nothing is derived
  from the data; a schema nobody chose is not a model.
- **Validation is per record** (LD2). One bad row does not fail a load, and no row
  is ever dropped in silence — every rejection lands in the report with a reason.
- **An edge whose endpoint does not resolve is rejected with both endpoints named**
  (LD7). A dangling edge is never written.
- **Everything written carries provenance** (LD4): the model, the record and the
  run that wrote it, stamped on the element itself.

Cypher backends (Neo4j / Memgraph) today: writes are identity-keyed `MERGE`, which
is what makes a re-run of the same file update rather than duplicate (C8).
"""

from __future__ import annotations

import json
from collections import Counter
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.pool import build_connector
from invana.apps.modeller.links import list_links
from invana.apps.modeller.solve import solvable, solve_links
from invana.apps.modeller.validator import SchemaValidator
from invana.core.settings import settings
from invana.runtime.catalogue.stitching import load_stitch_rows

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.models import ModelLink
    from invana.graph.connectors.base.connector import BaseConnector

_DEFAULT_IDENTITY = ["id"]


class LoadRefused(Exception):
    """Raised when records cannot be loaded (no such model, no connection, …)."""


async def connector_for(session: AsyncSession, graph_id: str) -> BaseConnector:
    """The Graph's connector, or the refusal that says why there is none."""
    connection = await GraphManager().get_graph_connection(session, graph_id=graph_id)
    if connection is None:
        raise LoadRefused("Graph has no connection — attach one before importing.")
    return build_connector(connection, settings.encryption_key)


# ---------------------------------------------------------------------------
# Reading the folder
# ---------------------------------------------------------------------------


def _read_records(directory: Path) -> dict[str, list[dict]]:
    """Read every <Type>.json in *directory* → {Type: [records]}."""
    out: dict[str, list[dict]] = {}
    if not directory.is_dir():
        return out
    for f in sorted(directory.glob("*.json")):
        out[f.stem] = json.loads(f.read_text())
    return out


def _identity_keys(model_json: dict, type_name: str) -> list[str]:
    """The properties identity is decided by — from the dataset's own declaration.

    Identity comes from the model's keys; the dataset may restate them per type so
    a `MERGE` knows what "the same node" means. Nothing is guessed beyond `id`.
    """
    spec = (model_json.get("nodes", {}) or {}).get(type_name, {}) or {}
    keys = spec.get("identity")
    return list(keys) if keys else list(_DEFAULT_IDENTITY)


# ---------------------------------------------------------------------------
# Cypher helpers
# ---------------------------------------------------------------------------


def _label(name: str) -> str:
    """Backtick-quote a Cypher label/rel-type; reject backticks (injection guard)."""
    if "`" in name:
        raise LoadRefused(f"Invalid type name: {name!r}")
    return f"`{name}`"


def _provenance(model_id: str, record_id: str, run_id: str, file: str) -> dict:
    """What every written element carries back to (LD4).

    Four ids, and each names a record that outlives the load: **the model** the
    element conforms to, **the record** it was, **the file** it arrived in and
    **the run** that wrote it. `_inv_model_id` is the namespace `_inv_record_id`
    lives in — record ids are whatever the source chose, so a pair is what makes
    the identity mean anything (BD17).

    Neither of the two renames here was a rename in place: a job id is not a run
    id and a dataset id is not a model id, so each was remapped through the
    table that knew the pairing before that table was dropped
    (task-model-migration § 6.6 · § 6.7).
    """
    return {
        "_inv_model_id": model_id,
        "_inv_record_id": record_id,
        "_inv_run_id": run_id,
        "_inv_file": file,
    }


def _log(logs: list[dict], level: str, stage: str, message: str, task_key: str | None = None) -> None:
    """One journal entry.

    `task_key` is the Task the line belongs to — the same key the run's trace
    gives its steps, so a Gantt row and a log line say the same word for the
    same Task and picking the bar can narrow the log to it (SR15 · SR21). A
    line that belongs to the run rather than to any one Task (`register`,
    `done`) carries `None`, and reads at run level.
    """
    logs.append(
        {
            "ts": datetime.now(UTC).isoformat(),
            "level": level,
            "stage": stage,
            "task_key": task_key,
            "message": message,
        }
    )


# A run streams the journal it is already writing (LD17): every entry a caller sees
# live is the same `stage`/`message` that lands in `job.logs`, so a load read as it
# happens and a load read afterwards tell the same story.
ProgressFn = Callable[[dict], None]

# Records between ticks while writing. Small enough that a slow connection still
# moves on screen, large enough that the callback is not the cost of the load.
TICK_EVERY = 500


# ---------------------------------------------------------------------------
# The report
# ---------------------------------------------------------------------------


def group_report(errors: list[dict]) -> list[dict]:
    """Rejections grouped by reason (IW2) — the count is the headline.

    One bad column is one line with a count, not four thousand lines. Each group
    keeps a few sample rows so the exact field is still one click away.
    """
    groups: dict[str, dict[str, Any]] = {}
    for error in errors:
        reason = error.get("rule") or error.get("message") or "unknown"
        group = groups.setdefault(reason, {"reason": reason, "count": 0, "files": Counter(), "samples": []})
        group["count"] += 1
        group["files"][error.get("file", "?")] += 1
        if len(group["samples"]) < 5:
            group["samples"].append(error)
    out = []
    for group in groups.values():
        group["files"] = dict(group["files"])
        out.append(group)
    return sorted(out, key=lambda g: -g["count"])


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def _validate_nodes(
    validator: SchemaValidator,
    node_records: dict[str, list[dict]],
    known_types: set[str],
    report: list[dict],
) -> dict[str, list[dict]]:
    valid: dict[str, list[dict]] = {}
    for type_name, records in node_records.items():
        if type_name not in known_types:
            # The whole file is rejected, once, naming the model it was checked
            # against — not one line per record saying the same thing.
            report.append(
                {
                    "file": f"nodes/{type_name}.json",
                    "record_index": None,
                    "record_id": None,
                    "field": None,
                    "rule": "unknown_node_type",
                    "message": f"The model has no node type {type_name!r}.",
                    "count": len(records),
                }
            )
            continue
        kept = []
        for i, rec in enumerate(records):
            errors = validator.validate_vertex_create(type_name, rec.get("properties", {}))
            if errors:
                report.extend(
                    {
                        "file": f"nodes/{type_name}.json",
                        "record_index": i,
                        "record_id": rec.get("id"),
                        "field": getattr(e, "field", None),
                        "rule": "invalid_property",
                        "message": e.message,
                    }
                    for e in errors
                )
            else:
                kept.append(rec)
        valid[type_name] = kept
    return valid


def _validate_edges(
    edge_records: dict[str, list[dict]],
    edge_endpoints: dict[str, tuple[set[str], set[str]]],
    node_ids: set[str],
    report: list[dict],
) -> tuple[dict[str, list[dict]], list[dict]]:
    """Keep edges whose endpoints are in this dataset; defer the rest to stitch.

    An endpoint the dataset does not carry is not yet an error: it may already be
    in the graph, put there by an earlier load or another model (LD7 is about
    endpoints that resolve *nowhere*). Those come back as the deferred list, and
    `stitch` decides.
    """
    valid: dict[str, list[dict]] = {}
    deferred: list[dict] = []
    for type_name, records in edge_records.items():
        if type_name not in edge_endpoints:
            report.append(
                {
                    "file": f"edges/{type_name}.json",
                    "record_index": None,
                    "record_id": None,
                    "field": None,
                    "rule": "unknown_edge_type",
                    "message": f"The model has no edge type {type_name!r}.",
                    "count": len(records),
                }
            )
            continue
        kept = []
        for i, rec in enumerate(records):
            source, target = rec.get("from"), rec.get("to")
            if source in node_ids and target in node_ids:
                kept.append(rec)
            else:
                deferred.append({"type": type_name, "index": i, "record": rec})
        valid[type_name] = kept
    return valid, deferred


# ---------------------------------------------------------------------------
# The import
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------


async def _write(
    connector: BaseConnector,
    *,
    model_id: str,
    run_id: str,
    model_json: dict,
    node_records: dict[str, list[dict]],
    edge_records: dict[str, list[dict]],
    on_tick: Callable[[int], None] | None = None,
) -> tuple[dict[str, dict[str, int]], int]:
    """MERGE nodes by identity, then edges between them. Everything stamped (LD4).

    One `MERGE` per record is what makes a re-run update rather than duplicate, and
    it is also why a large dataset takes minutes — so *on_tick* reports the running
    count every ``TICK_EVERY`` records (LD17).
    """
    counts: dict[str, dict[str, int]] = {"nodes": {}, "edges": {}}
    written = 0
    await connector.connect()
    try:
        for type_name, records in node_records.items():
            identity = _identity_keys(model_json, type_name)
            file = f"nodes/{type_name}.json"
            n = 0
            for rec in records:
                props = {"id": rec["id"], **(rec.get("properties", {}) or {})}
                key_frag = ", ".join(f"{k}: $key_{k}" for k in identity)
                query = f"MERGE (n:{_label(type_name)} {{{key_frag}}}) SET n += $props, n += $prov"
                params: dict[str, Any] = {
                    "props": props,
                    "prov": _provenance(model_id, str(rec["id"]), run_id, file),
                }
                params.update({f"key_{k}": props.get(k) for k in identity})
                await connector.execute(query, params)
                n += 1
                if on_tick and (written + n) % TICK_EVERY == 0:
                    on_tick(written + n)
            counts["nodes"][type_name] = n
            written += n

        for type_name, records in edge_records.items():
            file = f"edges/{type_name}.json"
            n = 0
            for rec in records:
                query = (
                    "MATCH (a {id: $from_id}), (b {id: $to_id}) "
                    f"MERGE (a)-[r:{_label(type_name)}]->(b) SET r += $props, r += $prov"
                )
                params = {
                    "from_id": rec["from"],
                    "to_id": rec["to"],
                    "props": {**(rec.get("properties", {}) or {})},
                    "prov": _provenance(model_id, str(rec.get("id", "")), run_id, file),
                }
                await connector.execute(query, params)
                n += 1
                if on_tick and (written + n) % TICK_EVERY == 0:
                    on_tick(written + n)
            counts["edges"][type_name] = n
            written += n
    finally:
        await connector.disconnect()
    return counts, written


async def _solve_active_stitches(
    session: AsyncSession,
    connector: BaseConnector,
    *,
    graph_id: str,
    # The model whose records ship a supplied stitch's rows — the one value that
    # used to be two, because the Dataset row and the model were always the same
    # container (task-model-migration § 6.7).
    model_id: str,
    run_id: str,
    root: Path,
    report: list[dict],
    admit: Callable[[ModelLink], Awaitable[bool]] | None = None,
    on_written: Callable[[ModelLink, int], None] | None = None,
) -> dict[str, int]:
    """Run the Graph's active stitches against this load (ST47, ST51).

    Two halves, both scoped to this load: every keyed stitch is solved over the
    records this import just wrote, and any stitch whose rows *this* model ships
    is loaded from `stitches/<EDGE_TYPE>.json` (LD19). Staged stitches are left
    alone — nothing outside the union may write to the graph — and a read-only
    connection writes nothing at all, here as everywhere.

    ``admit`` is the run's lens on each stitch's two models (ST53): a stitch it
    refuses is skipped and the rest are still solved. ``on_written`` hands each
    stitch's count back, so the step can say which models the edges went into.
    """
    connection = await GraphManager().get_graph_connection(session, graph_id=graph_id)
    if connection is None or connection.read_only:
        return {}
    active = await list_links(session, graph_id, status="active")
    joined = [link for link in active if solvable(link)]
    supplied = [link for link in active if link.source_model_id == model_id and link.edge_type]
    if admit is not None:
        joined = [link for link in joined if await admit(link)]
        supplied = [link for link in supplied if await admit(link)]
    if not joined and not supplied:
        return {}

    by_id = {link.id: link for link in joined}
    written: dict[str, int] = {}
    await connector.connect()
    try:
        for solved in await solve_links(connector, joined, run_id=run_id):
            if solved.written:
                written[solved.edge_type] = written.get(solved.edge_type, 0) + solved.written
                if on_written:
                    on_written(by_id[solved.link_id], solved.written)
        for link in supplied:
            loaded = await load_stitch_rows(connector, link, root=root, model_id=model_id)
            if loaded.written:
                written[loaded.edge_type] = written.get(loaded.edge_type, 0) + loaded.written
                if on_written:
                    on_written(link, loaded.written)
            report.extend(loaded.report)
    finally:
        await connector.disconnect()
    return written


async def _stitch(
    connector: BaseConnector,
    *,
    model_id: str,
    run_id: str,
    deferred: list[dict],
    report: list[dict],
    on_tick: Callable[[int], None] | None = None,
) -> tuple[dict[str, int], int]:
    """Resolve edges whose endpoints were not in this dataset.

    An endpoint already in the graph resolves; one that resolves nowhere is
    rejected **naming both endpoints** (LD7), never written as a dangle.
    """
    resolved: dict[str, int] = {}
    unresolved = 0
    if not deferred:
        return resolved, unresolved

    await connector.connect()
    try:
        for seen, item in enumerate(deferred, start=1):
            if on_tick and seen % TICK_EVERY == 0:
                on_tick(seen)
            rec = item["record"]
            type_name = item["type"]
            query = (
                "MATCH (a {id: $from_id}), (b {id: $to_id}) "
                f"MERGE (a)-[r:{_label(type_name)}]->(b) SET r += $props, r += $prov "
                "RETURN 1 AS ok"
            )
            params = {
                "from_id": rec.get("from"),
                "to_id": rec.get("to"),
                "props": {**(rec.get("properties", {}) or {})},
                "prov": _provenance(model_id, str(rec.get("id", "")), run_id, f"edges/{type_name}.json"),
            }
            result = await connector.execute(query, params)
            rows = getattr(result, "records", None) or getattr(result, "rows", None) or []
            if rows:
                resolved[type_name] = resolved.get(type_name, 0) + 1
            else:
                unresolved += 1
                report.append(
                    {
                        "file": f"edges/{type_name}.json",
                        "record_index": item["index"],
                        "record_id": rec.get("id"),
                        "field": None,
                        "rule": "unresolved_endpoint",
                        "message": (
                            f"{type_name}: neither this dataset nor the graph holds "
                            f"{rec.get('from')!r} → {rec.get('to')!r}."
                        ),
                    }
                )
    finally:
        await connector.disconnect()
    return resolved, unresolved
