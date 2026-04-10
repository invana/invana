"""Connector-agnostic CSV loader for the Invana Graph CSV format.

Reads structured CSV files from a directory layout::

    <dataset>/
        nodes/          # one CSV per vertex label
        relationships/  # one CSV per edge label

and bulk-loads them into any connected graph database via the
``connector.bulk`` queryset interface (``bulk_create_vertices`` /
``bulk_create_edges``).  No Cypher or Gremlin code lives here.
"""

from __future__ import annotations

import csv
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from invana.graph.connectors.base.connector import BaseConnector

logger = logging.getLogger(__name__)

_KNOWN_TYPE_SUFFIXES = {"string", "int", "long", "double", "float", "bool"}


# ---------------------------------------------------------------------------
# Configuration & statistics
# ---------------------------------------------------------------------------


@dataclass
class LoaderConfig:
    """Configuration for :class:`CSVLoader`."""

    batch_size: int = 500
    """Number of records sent to the connector per bulk call."""

    keep_source_ids: bool = True
    """Retain the ``source_id_property`` on vertices/edges after creation.
    Useful for traceability and future upsert support."""

    skip_on_error: bool = False
    """When ``True``, unresolvable edge references and connector errors are
    logged and skipped rather than aborting the load."""

    dry_run: bool = False
    """Parse and validate only — no writes to the database."""

    source_id_property: str = "_csv_source_id"
    """Property name injected into each vertex/edge to carry the original
    CSV ``Id`` value.  Used to build the in-memory ID mapping."""


@dataclass
class LoaderStats:
    """Aggregated statistics from a load operation."""

    vertices_created: int = 0
    edges_created: int = 0
    vertices_failed: int = 0
    edges_failed: int = 0
    vertices_by_label: dict[str, int] = field(default_factory=dict)
    edges_by_label: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    dry_run: bool = False


# ---------------------------------------------------------------------------
# CSV parsing helpers
# ---------------------------------------------------------------------------


def _parse_column_name(col: str) -> tuple[str, str | None]:
    """Strip ``Properties:`` prefix and split off an optional type suffix.

    Examples::

        _parse_column_name("Properties:code_string")   → ("code",  "string")
        _parse_column_name("Properties:runways_int")   → ("runways", "int")
        _parse_column_name("Properties:title")         → ("title", None)
    """
    base = col.removeprefix("Properties:")
    parts = base.rsplit("_", 1)
    if len(parts) == 2 and parts[1].lower() in _KNOWN_TYPE_SUFFIXES:
        return parts[0], parts[1].lower()
    return base, None


def _coerce_value(value: str, type_hint: str | None) -> Any:
    """Convert a raw CSV string cell to the appropriate Python type.

    Returns ``None`` for empty/blank strings so callers can omit the property.
    """
    if value is None or value.strip() == "":
        return None

    if type_hint == "string":
        return str(value)
    if type_hint in ("int", "long"):
        return int(float(value))  # handles "5.0" from float-like int columns
    if type_hint in ("double", "float"):
        return float(value)
    if type_hint == "bool":
        return value.strip().lower() in ("true", "1", "yes")

    # Auto-inference when no type suffix is present
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    if value.strip().lower() == "true":
        return True
    if value.strip().lower() == "false":
        return False
    return value


def _parse_node_row(row: dict[str, str], label_override: str | None) -> dict[str, Any]:
    """Parse one CSV row into ``{id, label, properties}``."""
    props: dict[str, Any] = {}
    for col, val in row.items():
        if not col.startswith("Properties:"):
            continue
        name, type_hint = _parse_column_name(col)
        coerced = _coerce_value(val, type_hint)
        if coerced is not None:
            props[name] = coerced
    return {
        "id": row.get("Id", ""),
        "label": label_override or row.get("Label") or "",
        "properties": props,
    }


def _parse_edge_row(row: dict[str, str], label_override: str | None) -> dict[str, Any]:
    """Parse one CSV row into ``{id, label, from_id, to_id, properties}``."""
    props: dict[str, Any] = {}
    for col, val in row.items():
        if not col.startswith("Properties:"):
            continue
        name, type_hint = _parse_column_name(col)
        coerced = _coerce_value(val, type_hint)
        if coerced is not None:
            props[name] = coerced
    return {
        "id": row.get("Id", ""),
        "label": label_override or row.get("Label") or "",
        "from_id": row.get("FromId") or row.get("SourceId") or "",
        "to_id": row.get("ToId") or row.get("TargetId") or "",
        "properties": props,
    }


def _read_csv(path: Path) -> list[dict[str, str]]:
    """Read a CSV file and return all rows as dicts."""
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _chunk(items: list, size: int):
    """Yield successive fixed-size chunks from *items*."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _merge_stats(target: LoaderStats, source: LoaderStats) -> None:
    """Accumulate *source* stats into *target* in-place."""
    target.vertices_created += source.vertices_created
    target.edges_created += source.edges_created
    target.vertices_failed += source.vertices_failed
    target.edges_failed += source.edges_failed
    target.errors.extend(source.errors)
    for lbl, cnt in source.vertices_by_label.items():
        target.vertices_by_label[lbl] = target.vertices_by_label.get(lbl, 0) + cnt
    for lbl, cnt in source.edges_by_label.items():
        target.edges_by_label[lbl] = target.edges_by_label.get(lbl, 0) + cnt


# ---------------------------------------------------------------------------
# CSVLoader
# ---------------------------------------------------------------------------


class CSVLoader:
    """Connector-agnostic loader for the Invana Graph CSV format.

    Calls only ``connector.bulk.bulk_create_vertices`` and
    ``connector.bulk.bulk_create_edges`` — no dialect-specific code.

    The loader maintains an in-memory mapping of ``csv_source_id → db_id``
    built from returned :class:`~invana.graph.types.data_elements.Vertex`
    objects.  Edges are resolved against this mapping before the bulk call.

    Usage::

        async with Neo4jConnector(...) as conn:
            loader = CSVLoader(conn, LoaderConfig(batch_size=1000))
            stats = await loader.load_directory("datasets/air-routes")
            print(stats.vertices_created, stats.edges_created)
    """

    def __init__(self, connector: BaseConnector, config: LoaderConfig | None = None) -> None:
        self._connector = connector
        self._config = config or LoaderConfig()
        # csv_source_id (str) → database vertex id (str)
        # Accumulated across all node files in this loader instance's lifetime.
        self._id_mapping: dict[str, str] = {}

    async def __aenter__(self) -> CSVLoader:
        return self

    async def __aexit__(self, *args: Any) -> None:
        pass

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def load_directory(self, path: str | Path) -> LoaderStats:
        """Load ``nodes/`` and ``relationships/`` subdirectories from *path*.

        Nodes are loaded before relationships (alphabetically within each
        subdirectory).  Either subdirectory is optional — if absent it is
        silently skipped.

        Args:
            path: Path to the dataset root directory.

        Returns:
            Aggregated :class:`LoaderStats` for the entire directory.

        Raises:
            FileNotFoundError: If *path* does not exist or is not a directory.
        """
        root = Path(path).resolve()
        if not root.is_dir():
            raise FileNotFoundError(f"Directory not found: {path}")

        stats = LoaderStats(dry_run=self._config.dry_run)
        start = time.monotonic()

        nodes_dir = root / "nodes"
        rels_dir = root / "relationships"

        if nodes_dir.is_dir():
            for csv_file in sorted(nodes_dir.glob("*.csv")):
                _merge_stats(stats, await self.load_nodes_file(csv_file))

        if rels_dir.is_dir():
            for csv_file in sorted(rels_dir.glob("*.csv")):
                _merge_stats(stats, await self.load_edges_file(csv_file))

        stats.duration_seconds = time.monotonic() - start
        logger.info(
            "  loaded %s  vertices=%-6d edges=%-6d errors=%d  (%.2fs)",
            Path(path).name,
            stats.vertices_created,
            stats.edges_created,
            len(stats.errors),
            stats.duration_seconds,
        )
        return stats

    async def load_nodes_file(self, path: str | Path, label: str | None = None) -> LoaderStats:
        """Load a single node CSV file.

        Args:
            path: Path to the CSV file.
            label: Override the vertex label for every row (ignores the
                ``Label`` column when provided).

        Returns:
            :class:`LoaderStats` for this file.
        """
        path = Path(path).resolve()
        stats = LoaderStats(dry_run=self._config.dry_run)
        start = time.monotonic()

        rows = _read_csv(path)
        parsed = [_parse_node_row(r, label) for r in rows]

        by_label: dict[str, list[dict]] = {}
        for node in parsed:
            lbl = node["label"]
            if not lbl:
                msg = f"{path.name} row Id={node['id']!r}: missing label, skipping"
                logger.warning(msg)
                stats.errors.append(msg)
                stats.vertices_failed += 1
                continue
            by_label.setdefault(lbl, []).append(node)

        for lbl, nodes in by_label.items():
            await self._create_vertices_for_label(lbl, nodes, stats)

        stats.duration_seconds = time.monotonic() - start
        return stats

    async def load_edges_file(self, path: str | Path, label: str | None = None) -> LoaderStats:
        """Load a single edge/relationship CSV file.

        Args:
            path: Path to the CSV file.
            label: Override the edge label for every row.

        Returns:
            :class:`LoaderStats` for this file.
        """
        path = Path(path).resolve()
        stats = LoaderStats(dry_run=self._config.dry_run)
        start = time.monotonic()

        rows = _read_csv(path)
        parsed = [_parse_edge_row(r, label) for r in rows]

        by_label: dict[str, list[dict]] = {}
        for edge in parsed:
            lbl = edge["label"]
            if not lbl:
                msg = f"{path.name} row Id={edge['id']!r}: missing label, skipping"
                logger.warning(msg)
                stats.errors.append(msg)
                stats.edges_failed += 1
                continue
            by_label.setdefault(lbl, []).append(edge)

        for lbl, edges in by_label.items():
            await self._create_edges_for_label(lbl, edges, stats)

        stats.duration_seconds = time.monotonic() - start
        return stats

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    async def _create_vertices_for_label(self, label: str, nodes: list[dict], stats: LoaderStats) -> None:
        cfg = self._config
        total = len(nodes)
        created = 0
        failed = 0

        for batch in _chunk(nodes, cfg.batch_size):
            # Flat property dicts — exactly what bulk_create_vertices expects
            records = []
            for node in batch:
                props = dict(node["properties"])
                props[cfg.source_id_property] = node["id"]
                records.append(props)

            if cfg.dry_run:
                created += len(records)
                stats.vertices_created += len(records)
                stats.vertices_by_label[label] = stats.vertices_by_label.get(label, 0) + len(records)
                continue

            try:
                vertices = await self._connector.bulk.bulk_create_vertices(label, records)
                for v in vertices:
                    src_id = v.properties.get(cfg.source_id_property)
                    if src_id is not None:
                        self._id_mapping[str(src_id)] = v.id
                created += len(vertices)
                stats.vertices_created += len(vertices)
                stats.vertices_by_label[label] = stats.vertices_by_label.get(label, 0) + len(vertices)
                batch_failed = len(records) - len(vertices)
                if batch_failed > 0:
                    failed += batch_failed
                    stats.vertices_failed += batch_failed
            except Exception as exc:
                msg = f"Failed to create {label} vertices (batch of {len(records)}): {exc}"
                logger.error(msg)
                stats.errors.append(msg)
                failed += len(records)
                stats.vertices_failed += len(records)
                if not cfg.skip_on_error:
                    raise

        pct_err = (failed / total * 100) if total else 0.0
        if failed == 0:
            logger.info("  [nodes]         %-20s  err: %.2f%%  %d/%d", label, pct_err, created, total)
        else:
            logger.warning(
                "  [nodes]         %-20s  err: %.2f%%  %d/%d  (%d failed)",
                label,
                pct_err,
                created,
                total,
                failed,
            )

    async def _create_edges_for_label(self, label: str, edges: list[dict], stats: LoaderStats) -> None:
        cfg = self._config

        # Resolve CSV IDs → database IDs
        resolved: list[dict] = []
        for edge in edges:
            from_db = self._id_mapping.get(str(edge["from_id"]))
            to_db = self._id_mapping.get(str(edge["to_id"]))

            if from_db is None or to_db is None:
                missing = []
                if from_db is None:
                    missing.append(f"from_id={edge['from_id']!r}")
                if to_db is None:
                    missing.append(f"to_id={edge['to_id']!r}")
                msg = f"Edge Id={edge['id']!r}: unresolved node reference(s): {', '.join(missing)}"
                logger.warning(msg)
                stats.errors.append(msg)
                stats.edges_failed += 1
                if not cfg.skip_on_error:
                    raise ValueError(msg)
                continue

            resolved.append(
                {
                    "source_id": from_db,
                    "target_id": to_db,
                    "properties": dict(edge["properties"]),
                }
            )

        total = len(resolved)
        unresolved = len(edges) - total
        created_count = 0
        failed_count = unresolved  # unresolved refs already count as failed

        for batch in _chunk(resolved, cfg.batch_size):
            if cfg.dry_run:
                created_count += len(batch)
                stats.edges_created += len(batch)
                stats.edges_by_label[label] = stats.edges_by_label.get(label, 0) + len(batch)
                continue

            try:
                created = await self._connector.bulk.bulk_create_edges(label, batch)
                created_count += len(created)
                stats.edges_created += len(created)
                stats.edges_by_label[label] = stats.edges_by_label.get(label, 0) + len(created)
                batch_failed = len(batch) - len(created)
                if batch_failed > 0:
                    failed_count += batch_failed
                    stats.edges_failed += batch_failed
            except Exception as exc:
                msg = f"Failed to create {label} edges (batch of {len(batch)}): {exc}"
                logger.error(msg)
                stats.errors.append(msg)
                failed_count += len(batch)
                stats.edges_failed += len(batch)
                if not cfg.skip_on_error:
                    raise

        total_edges = len(edges)
        pct_err = (failed_count / total_edges * 100) if total_edges else 0.0
        if failed_count == 0:
            logger.info(
                "  [relationships] %-20s  err: %.2f%%  %d/%d",
                label,
                pct_err,
                created_count,
                total_edges,
            )
        else:
            logger.warning(
                "  [relationships] %-20s  err: %.2f%%  %d/%d  (%d failed)",
                label,
                pct_err,
                created_count,
                total_edges,
                failed_count,
            )
