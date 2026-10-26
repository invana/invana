"""The migration scan — what a breaking change touches in the graph, record by record.

docs/for-developers/modules/connect-and-model/features/publish-review.md.
For every type a breaking change names, read its total and at most ``SCAN_LIMIT``
of its records, and for each record ask two things: does the model read it
differently (``before`` against the published version, ``after`` against the
draft), and does it newly fail the draft — an error the draft's validator raises
that the published version's did not, or a duplicate on a key the draft makes
unique. Nothing is written; a record that no longer fits is listed, never changed::

    scan = await MigrationScan().scan(connector.data_reader, base=active, draft=draft,
                                      changes=classification.changes, validation_mode="strict")
    scan["affected"], scan["would_fail"], scan["types"][0]["samples"]

Counts are of what was scanned, and each type says how many that was beside its
total — never extrapolated. The reader is the connector's dialect-neutral data
reader, so the scan runs the same against openCypher and Gremlin databases.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from invana.apps.modeller.validator import SchemaValidator

if TYPE_CHECKING:
    from invana.apps.modeller.models import GraphVersion
    from invana.apps.modeller.schemas import ModelPublishChange
    from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet

SCAN_LIMIT = 1000
SAMPLES = 3


def _plain(value: Any) -> Any:
    """A record's values as JSON holds them — dates and points become strings."""
    return json.loads(json.dumps(value, default=str))


def _mapped(version: GraphVersion | None, kind: str, name: str) -> set[str] | None:
    """The property names ``version`` models on a type; ``None`` when it has no such type."""
    if version is None:
        return None
    types = version.node_types if kind == "node" else version.edge_types
    found = next((t for t in types if t.name == name), None)
    return None if found is None else {m.property_key.name for m in found.property_mappings}


def _kind(base: GraphVersion | None, draft: GraphVersion, name: str) -> str | None:
    for version in (draft, base):
        if version is None:
            continue
        if any(t.name == name for t in version.node_types):
            return "node"
        if any(t.name == name for t in version.edge_types):
            return "edge"
    return None


def _touched(
    base: GraphVersion | None, draft: GraphVersion, changes: list[ModelPublishChange]
) -> dict[tuple[str, str], list[ModelPublishChange]]:
    """(kind, type) → the breaking changes that touch it. A property key's change touches every type mapping it."""
    out: dict[tuple[str, str], list[ModelPublishChange]] = {}
    for change in (c for c in changes if c.breaking):
        names: list[str] = []
        if change.type:
            names = [change.type]
        elif change.target_kind == "property_key" and change.property and base is not None:
            names = [
                t.name
                for t in [*base.node_types, *base.edge_types]
                if any(m.property_key.name == change.property for m in t.property_mappings)
            ]
        for name in names:
            kind = _kind(base, draft, name)
            if kind is not None:
                out.setdefault((kind, name), []).append(change)
    return out


def _unique_keys(version: GraphVersion, label: str) -> list[tuple[str, ...]]:
    return [
        tuple(c.properties)
        for c in version.constraints
        if c.target_label == label and c.constraint_type in ("unique", "node_key", "relationship_unique")
    ]


class MigrationScan:
    """Stateless; reads through the reader it is handed."""

    async def scan(
        self,
        reader: BaseDataReaderQuerySet,
        *,
        base: GraphVersion | None,
        draft: GraphVersion,
        changes: list[ModelPublishChange],
        validation_mode: str,
        limit: int = SCAN_LIMIT,
        list_failures: bool = False,
    ) -> dict:
        """Scan every type a breaking change touches; ``list_failures`` adds every failing record's id."""
        before_v, after_v = SchemaValidator(), SchemaValidator()
        if base is not None:
            before_v.load(base, validation_mode)
        after_v.load(draft, validation_mode)

        types: list[dict] = []
        for (kind, name), touching in sorted(_touched(base, draft, changes).items()):
            removed = _mapped(draft, kind, name) is None
            before_props, after_props = _mapped(base, kind, name), _mapped(draft, kind, name)
            if kind == "node":
                total = await reader.count_vertices(name)
                records = await reader.read_vertices(name, limit=limit)
            else:
                total = await reader.count_edges(name)
                records = await reader.read_edges(name, limit=limit)

            failures: dict[str, list[str]] = {}
            if not removed:
                for record in records:
                    props = record.properties or {}
                    if kind == "node":
                        new = after_v.validate_vertex_create(name, props)
                        old = before_v.validate_vertex_create(name, props) if base is not None else []
                    else:
                        new = after_v.validate_edge_properties(name, props)
                        old = before_v.validate_edge_properties(name, props) if base is not None else []
                    # A flagged break lets the record land, so it does not fail it.
                    fresh = [e.message for e in new if not e.flag and e.message not in {o.message for o in old}]
                    if fresh:
                        failures[record.id] = fresh
                old_unique = set(_unique_keys(base, name)) if base is not None else set()
                for key in _unique_keys(draft, name):
                    if key in old_unique:
                        continue
                    seen: dict[tuple, str] = {}
                    for record in records:
                        value = tuple(json.dumps((record.properties or {}).get(p), default=str) for p in key)
                        if value in seen:
                            for rid in (seen[value], record.id):
                                failures.setdefault(rid, []).append(f"Duplicate value on {', '.join(key)}.")
                        else:
                            seen[value] = record.id
                for change in (c for c in touching if c.kind == "endpoints_narrowed"):
                    for gone in (change.property or "").split(", "):
                        for edge in await reader.read_edges(name, source_label=gone, limit=limit):
                            failures.setdefault(edge.id, []).append(f"Source type '{gone}' is no longer allowed.")
                        for edge in await reader.read_edges(name, target_label=gone, limit=limit):
                            failures.setdefault(edge.id, []).append(f"Target type '{gone}' is no longer allowed.")

            rows = []
            for record in records:
                props = record.properties or {}
                before = {k: v for k, v in props.items() if before_props is None or k in before_props}
                after = None if removed else {k: v for k, v in props.items() if k in (after_props or set())}
                errors = failures.get(record.id, [])
                if removed or before != after or errors:
                    rows.append({"id": record.id, "before": before, "after": after, "errors": errors})
            rows.sort(key=lambda r: not r["errors"])
            entry = {
                "kind": kind,
                "type": name,
                "total": int(total),
                "scanned": len(records),
                "affected": len(rows),
                "would_fail": len(failures),
                "removed": removed,
                "changes": sorted({c.kind for c in touching}),
                "samples": _plain(rows[:SAMPLES]),
            }
            if list_failures:
                entry["failed"] = [{"id": rid, "errors": errs} for rid, errs in failures.items()]
            types.append(entry)
        return {
            "scan_limit": limit,
            "types": types,
            "affected": sum(t["affected"] for t in types),
            "would_fail": sum(t["would_fail"] for t in types),
        }
