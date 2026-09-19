"""Bundle preflight — resolve a `stitches.json` against the files on disk.

A **bundle** is a folder of datasets that belong together, with a manifest at its root
saying how they join (load-data.md LD12). This checks each rule before anything is
imported: no Graph, no connection, no model in a database, nothing declared.

It reads whichever shape a dataset carries — `nodes/<Type>.json` for the Datasets journal,
`nodes/<type>.csv` for `invana loader` — so a bundle is checkable whichever path it is
loaded through.

Counts are **distinct key values**, because that is what `…/model-links/preview` reports
(LD13): a rule joins values, not rows, and 26 airlines share 24 hub codes.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

MANIFEST = "stitches.json"

_KNOWN_TYPE_SUFFIXES = {"string", "int", "long", "double", "float", "bool"}


class BundleError(Exception):
    """The manifest is unreadable or says something that cannot be checked."""


# ---------------------------------------------------------------------------
# The manifest
# ---------------------------------------------------------------------------


@dataclass
class Rule:
    """One declared stitch, as the manifest states it."""

    id: str
    kind: str
    source_dataset: str
    source_type: str
    source_property: str
    target_dataset: str
    target_type: str
    target_property: str
    identity_match: str = "exact"
    edge_type: str | None = None
    #: A relationship whose endpoints are their own fact names the file that
    #: holds them, under the source folder's `stitches/` (W3, LD19). It names a
    #: **file**; it never named a Dataset.
    rows: str | None = None
    partial: bool = False

    @property
    def arrow(self) -> str:
        return "≡" if self.kind == "anchor" else f"-[{self.edge_type}]->"

    def describe(self) -> str:
        return f"{self.source_type}.{self.source_property} {self.arrow} {self.target_type}.{self.target_property}"


@dataclass
class Manifest:
    name: str
    datasets: list[str]
    rules: list[Rule] = field(default_factory=list)


def _endpoint(value: str, where: str) -> tuple[str, str, str]:
    """`<dataset>:<Type>.<property>` → its three parts."""
    if ":" not in value or "." not in value.split(":", 1)[1]:
        raise BundleError(f"{where}: expected '<dataset>:<Type>.<property>', got {value!r}.")
    dataset, rest = value.split(":", 1)
    type_name, prop = rest.rsplit(".", 1)
    if not (dataset and type_name and prop):
        raise BundleError(f"{where}: expected '<dataset>:<Type>.<property>', got {value!r}.")
    return dataset, type_name, prop


def read_manifest(root: Path) -> Manifest:
    """Read and validate ``<root>/stitches.json``."""
    path = root / MANIFEST
    if not path.is_file():
        raise BundleError(f"No {MANIFEST} in {root}. A bundle states its stitches in one.")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise BundleError(f"{path} is not valid JSON: {exc}") from exc

    datasets = list(raw.get("datasets") or [])
    if not datasets:
        raise BundleError(f"{path} names no datasets.")
    for name in datasets:
        if not (root / name).is_dir():
            raise BundleError(f"{path} names dataset {name!r}, which is not a folder in {root}.")

    rules: list[Rule] = []
    for i, item in enumerate(raw.get("stitches") or []):
        rule_id = str(item.get("id") or f"#{i + 1}")
        where = f"{MANIFEST} stitch {rule_id}"
        kind = item.get("kind")
        if kind not in ("anchor", "relationship"):
            raise BundleError(f"{where}: kind must be 'anchor' or 'relationship', got {kind!r}.")
        match = item.get("identity_match", "exact")
        if match not in ("exact", "case_insensitive"):
            raise BundleError(f"{where}: identity_match must be 'exact' or 'case_insensitive', got {match!r}.")
        if kind == "relationship" and not (item.get("edge_type") or item.get("rows")):
            raise BundleError(f"{where}: a relationship needs an edge_type.")
        if kind == "anchor" and item.get("edge_type"):
            raise BundleError(f"{where}: an anchor carries no edge_type.")

        sd, st, sp = _endpoint(item.get("source", ""), where)
        td, tt, tp = _endpoint(item.get("target", ""), where)
        for name in (sd, td):
            if name not in datasets:
                raise BundleError(f"{where}: dataset {name!r} is not one of the bundle's datasets.")

        rules.append(
            Rule(
                id=rule_id,
                kind=kind,
                source_dataset=sd,
                source_type=st,
                source_property=sp,
                target_dataset=td,
                target_type=tt,
                target_property=tp,
                identity_match=match,
                edge_type=item.get("edge_type"),
                rows=item.get("rows"),
                partial=bool(item.get("partial")),
            )
        )

    return Manifest(name=str(raw.get("name") or root.name), datasets=datasets, rules=rules)


# ---------------------------------------------------------------------------
# Reading a dataset's values, whichever shape it ships in
# ---------------------------------------------------------------------------


def _csv_property(column: str) -> str:
    base = column.removeprefix("Properties:")
    head, _, suffix = base.rpartition("_")
    return head if head and suffix.lower() in _KNOWN_TYPE_SUFFIXES else base


def read_values(root: Path, dataset: str, type_name: str, prop: str) -> list[str]:
    """Every value of *prop* on *type_name*, from the JSON records or the CSV.

    Raises when the type is not in the dataset at all — a rule naming a type nobody
    ships is a broken rule, not an empty one.
    """
    base = root / dataset
    as_json = base / "nodes" / f"{type_name}.json"
    if as_json.is_file():
        records = json.loads(as_json.read_text(encoding="utf-8"))
        return [str(r["properties"][prop]) for r in records if prop in (r.get("properties") or {})]

    as_csv = base / "nodes" / f"{type_name.lower()}.csv"
    if as_csv.is_file():
        out = []
        with as_csv.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                for column, value in row.items():
                    if column.startswith("Properties:") and _csv_property(column) == prop and value:
                        out.append(value)
        return out

    raise BundleError(f"{dataset} has no node type {type_name!r} — looked for nodes/{type_name}.json and its CSV.")


def read_ids(root: Path, dataset: str, type_name: str) -> set[str]:
    """The node ids a dataset ships for *type_name* — what a stitch dataset's rows point at."""
    base = root / dataset
    as_json = base / "nodes" / f"{type_name}.json"
    if as_json.is_file():
        return {str(r["id"]) for r in json.loads(as_json.read_text(encoding="utf-8")) if "id" in r}

    as_csv = base / "nodes" / f"{type_name.lower()}.csv"
    if as_csv.is_file():
        with as_csv.open(encoding="utf-8", newline="") as fh:
            return {row["Id"] for row in csv.DictReader(fh) if row.get("Id")}

    raise BundleError(f"{dataset} has no node type {type_name!r} — looked for nodes/{type_name}.json and its CSV.")


def read_edge_endpoints(root: Path, dataset: str, file_name: str) -> list[dict[str, Any]]:
    """The records of a stitch whose endpoints are their own fact (W3)."""
    path = root / dataset / "stitches" / file_name
    if not path.is_file():
        path = root / dataset / file_name
    if not path.is_file():
        raise BundleError(f"{dataset} has no stitch rows file {file_name!r}.")
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Structure — each dataset against its own model (LD15)
# ---------------------------------------------------------------------------

_PY_TYPES: dict[str, Any] = {
    "integer": int,
    "float": (int, float),
    "boolean": bool,
    "string": str,
    "enum": str,
    "uuid": str,
    "date": str,
    "datetime": str,
    "time": str,
}


@dataclass
class Finding:
    """One structural problem, with a count and a couple of examples."""

    check: str
    detail: str
    count: int = 0
    samples: list[str] = field(default_factory=list)


@dataclass
class DatasetResult:
    name: str
    nodes: int = 0
    edges: int = 0
    findings: list[Finding] = field(default_factory=list)
    deferred: int = 0
    error: str | None = None

    @property
    def passed(self) -> bool:
        return self.error is None and not self.findings


def _finding(check: str, detail: str, offenders: list[str]) -> Finding | None:
    if not offenders:
        return None
    return Finding(check=check, detail=detail, count=len(offenders), samples=offenders[:3])


def _load_dataset(root: Path, name: str) -> tuple[dict[str, list[dict]], dict[str, list[dict]]]:
    base = root / name
    nodes = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted((base / "nodes").glob("*.json"))}
    edges = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted((base / "edges").glob("*.json"))}
    return nodes, edges


def check_dataset(root: Path, name: str, bundle_ids: set[str] | None = None) -> DatasetResult:
    """Validate one dataset against its own `graph-model.json` and `model.json` (LD15).

    ``bundle_ids`` is every id the bundle carries; an endpoint outside this dataset but
    inside the bundle resolves, and anything left is *deferred*, never failed (LD16).
    """
    result = DatasetResult(name=name)
    base = root / name
    try:
        model = json.loads((base / "graph-model.json").read_text(encoding="utf-8"))["model"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        result.error = f"cannot read {name}/graph-model.json: {exc}"
        return result

    declared = {p["name"]: p for p in model.get("property_keys", [])}
    node_props = {
        nt["name"]: {m["property_key"] for m in nt.get("property_mappings", [])} for nt in model.get("node_types", [])
    }
    edge_props = {
        et["name"]: {m["property_key"] for m in et.get("property_mappings", [])} for et in model.get("edge_types", [])
    }
    endpoints = {
        et["name"]: (set(et.get("source_node_types") or []), set(et.get("target_node_types") or []))
        for et in model.get("edge_types", [])
    }

    identity_spec = {}
    model_json = base / "model.json"
    if model_json.is_file():
        identity_spec = json.loads(model_json.read_text(encoding="utf-8")).get("nodes", {}) or {}

    nodes, edges = _load_dataset(root, name)
    result.nodes = sum(len(r) for r in nodes.values())
    result.edges = sum(len(r) for r in edges.values())

    label_of: dict[str, str] = {}
    id_counts: Counter[str] = Counter()
    unknown_types, undeclared, bad_type, bad_enum, no_key, dupe_key = [], [], [], [], [], []

    for type_name, records in nodes.items():
        if type_name not in node_props:
            unknown_types.append(f"nodes/{type_name}.json")
            continue
        keys = (identity_spec.get(type_name) or {}).get("identity") or ["id"]
        seen: Counter[tuple] = Counter()
        for record in records:
            rid = str(record.get("id", ""))
            id_counts[rid] += 1
            label_of[rid] = type_name
            props = record.get("properties") or {}
            for key, value in props.items():
                if key not in node_props[type_name]:
                    undeclared.append(f"{type_name}.{key}")
                    continue
                spec = declared.get(key, {})
                expected = _PY_TYPES.get(spec.get("type", "string"))
                if expected and not isinstance(value, expected):
                    bad_type.append(f"{type_name}.{key}={value!r} is not {spec.get('type')}")
                for rule in spec.get("validation_rules", []):
                    if rule.get("rule_type") == "enum" and value not in rule.get("params", {}).get("values", []):
                        bad_enum.append(f"{type_name}.{key}={value!r}")
            values = tuple(props.get(k, record.get(k) if k == "id" else None) for k in keys)
            if any(v is None or v == "" for v in values):
                no_key.append(f"{type_name} id={rid} has no {'/'.join(keys)}")
            else:
                seen[values] += 1
        dupe_key += [f"{type_name} {'/'.join(keys)}={v}" for v, n in seen.items() if n > 1]

    known_ids = set(id_counts)
    reachable = known_ids | (bundle_ids or set())
    wrong_end, deferred = [], []

    for type_name, records in edges.items():
        if type_name not in endpoints:
            unknown_types.append(f"edges/{type_name}.json")
            continue
        source_types, target_types = endpoints[type_name]
        for record in records:
            for key in record.get("properties") or {}:
                if key not in edge_props[type_name]:
                    undeclared.append(f"{type_name}.{key}")
            source, target = str(record.get("from")), str(record.get("to"))
            if source not in reachable or target not in reachable:
                deferred.append(f"{type_name} {source} → {target}")
                continue
            if source in label_of and label_of[source] not in source_types:
                wrong_end.append(f"{type_name} from {label_of[source]}, declared {sorted(source_types)}")
            if target in label_of and label_of[target] not in target_types:
                wrong_end.append(f"{type_name} to {label_of[target]}, declared {sorted(target_types)}")

    result.deferred = len(deferred)
    candidates = [
        _finding("node_ids_unique", "records sharing an id", [i for i, n in id_counts.items() if n > 1]),
        _finding("identity_key_present", "records with no identity key", no_key),
        _finding("identity_key_unique", "identity keys used more than once", dupe_key),
        _finding("type_declared", "record files naming a type the model does not have", unknown_types),
        _finding("property_declared", "properties not declared on their type", sorted(set(undeclared))),
        _finding("property_type", "values that are not the declared type", bad_type),
        _finding("enum_value", "values outside the enum the model names", bad_enum),
        _finding("endpoint_types", "edges landing on undeclared types", sorted(set(wrong_end))),
    ]
    result.findings = [f for f in candidates if f is not None]
    return result


# ---------------------------------------------------------------------------
# The check
# ---------------------------------------------------------------------------


@dataclass
class RuleResult:
    rule: Rule
    resolved: int = 0
    total: int = 0
    rows: int = 0
    unresolved: list[str] = field(default_factory=list)
    passed: bool = False
    error: str | None = None

    @property
    def countable(self) -> bool:
        return self.total > 0


def check_rule(root: Path, rule: Rule) -> RuleResult:
    """Resolve one rule against the files. Distinct key values, as the preview counts."""
    result = RuleResult(rule=rule)
    try:
        left = read_values(root, rule.source_dataset, rule.source_type, rule.source_property)
        right = read_values(root, rule.target_dataset, rule.target_type, rule.target_property)
    except BundleError as exc:
        result.error = str(exc)
        return result

    fold = rule.identity_match == "case_insensitive"
    keys = {v.lower() if fold else v for v in left}
    known = {v.lower() if fold else v for v in right}

    result.rows = len(left)
    result.total = len(keys)
    hit = keys & known
    result.resolved = len(hit)
    result.unresolved = sorted(keys - hit)
    # Nothing to judge the rule against is not a verdict (mirrors the engine's `countable`).
    result.passed = bool(hit) and (rule.partial or not result.unresolved) if result.countable else False
    return result


def check_rows_rule(root: Path, rule: Rule) -> RuleResult:
    """A relationship whose endpoints arrive in a dataset (W3).

    There is no key pair to join here — each row *is* an edge, naming a node on each
    side by id. So both endpoints have to exist, and an endpoint that resolves nowhere
    is the rejection LD7 describes, found before the import rather than during it.
    """
    result = RuleResult(rule=rule)
    try:
        records = read_edge_endpoints(root, rule.source_dataset, rule.rows or "")
        sources = read_ids(root, rule.source_dataset, rule.source_type)
        targets = read_ids(root, rule.target_dataset, rule.target_type)
    except BundleError as exc:
        result.error = str(exc)
        return result

    dangling = [
        f"{rec.get('from')} → {rec.get('to')}"
        for rec in records
        if str(rec.get("from")) not in sources or str(rec.get("to")) not in targets
    ]
    result.rows = result.total = len(records)
    result.resolved = len(records) - len(dangling)
    result.unresolved = sorted(dangling)
    result.passed = bool(records) and not dangling
    return result


@dataclass
class Report:
    """Structure first, then the joins (LD15)."""

    manifest: Manifest
    datasets: list[DatasetResult] = field(default_factory=list)
    rules: list[RuleResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(d.passed for d in self.datasets) and all(r.passed for r in self.rules)


def check(root: Path) -> Report:
    """Validate every dataset against its own model, then resolve every rule between them."""
    root = Path(root).resolve()
    if not root.is_dir():
        raise BundleError(f"Not a directory: {root}")
    manifest = read_manifest(root)

    # Every id the bundle carries, so an endpoint into a sibling dataset resolves (LD16).
    bundle_ids: set[str] = set()
    for name in manifest.datasets:
        nodes, _ = _load_dataset(root, name)
        bundle_ids |= {str(r.get("id", "")) for records in nodes.values() for r in records}

    datasets = [check_dataset(root, name, bundle_ids) for name in manifest.datasets]
    rules = [check_rows_rule(root, rule) if rule.rows else check_rule(root, rule) for rule in manifest.rules]
    return Report(manifest=manifest, datasets=datasets, rules=rules)
