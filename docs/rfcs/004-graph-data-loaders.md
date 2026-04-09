# RFC-004: Graph Data Loaders

> **Status**: Implemented
> **Author**: Ravi Merugu
> **Created**: 2026-04-09
> **Updated**: 2026-04-10

## Summary

A `loaders` module under `engine/src/invana/` that reads structured CSV files and bulk-loads them into any connected graph database via the existing `connector.bulk` queryset interface. The module ships with a single connector-agnostic `CSVLoader` (covering both Cypher and Gremlin backends) and a clear CSV format specification (`Invana Graph CSV`) that all `datasets/` follow.

## Motivation

- **Dataset bootstrapping** — The `datasets/` directory ships three complete graph datasets (air-routes, movies, drug-interactions). Without a loader, users have no supported way to import them, and the datasets become dead documentation assets.
- **Integration test dependency** — RFC-001 mandates tests against real graph databases, not mocks. The integration tests in `invana-neo4j`, `invana-janusgraph`, etc. all need a reliable way to seed test data into a live database before assertions run.
- **Unified ingestion path** — The old `contrib/loaders/` required two separate class hierarchies (`CypherCSVLoader` / `GremlinCSVLoader`) because the old bulk queryset embedded language-specific orchestration. The new `BaseBulkQuerySet` from RFC-001 provides a language-neutral interface (`bulk_create_vertices` / `bulk_create_edges`) that makes a single universal loader feasible.
- **If we don't do this** — Every dataset example, tutorial, and integration test writes its own ad-hoc data seeding code, creating fragmentation and making datasets harder to maintain.

## Design

### Module Location

```
engine/src/invana/graph/loaders/
```

This is nested inside `graph/` because loading is a graph-layer concern that uses connectors (via their public interface) directly alongside them.

### Directory Structure

```
engine/src/invana/
├── loaders/
│   ├── __init__.py          # exports CSVLoader, LoaderConfig, LoaderStats
│   └── csv.py               # single implementation file
engine/tests/
└── loaders/
    ├── __init__.py
    ├── test_csv_loader.py   # unit tests (no DB) — parsing, type coercion, directory discovery
    └── fixtures/
        ├── nodes/
        │   ├── person.csv
        │   └── movie.csv
        └── relationships/
            └── acted_in.csv
```

### Invana Graph CSV Format Specification

All files inside `datasets/` conform to this format. The loader enforces it.

#### Nodes

```
Id,Label,Properties:name[_type],Properties:name[_type],...
```

| Column | Required | Description |
|---|---|---|
| `Id` | Yes | Unique identifier within the dataset (string or integer). Becomes `_csv_source_id` property. |
| `Label` | Yes | Vertex label (case-sensitive). The directory auto-discovery uses the filename as a default fallback. |
| `Properties:<name>[_<type>]` | 0+ | Property value. Optional `_<type>` suffix declares the target type. |

**Type suffixes** (case-insensitive):

| Suffix | Python type | Notes |
|---|---|---|
| `_string` | `str` | Default when no suffix is present |
| `_int` | `int` | Raises `ValueError` if value is not numeric |
| `_long` | `int` | Alias for `_int` |
| `_double` | `float` | |
| `_float` | `float` | Alias for `_double` |
| `_bool` | `bool` | Accepts `true`/`1`/`yes` (case-insensitive) as `True`, anything else as `False` |
| _(none)_ | auto | Type inference: try `int`, then `float`, then `bool`, else `str` |

Empty cells are loaded as `None` and omitted from the property map.

Examples from existing datasets:
```csv
# air-routes (typed suffixes):
Id,Label,Properties:code_string,Properties:runways_int,Properties:lat_double
1,airport,ATL,5,33.636

# movies (untyped — auto-inference):
Id,Label,Properties:title,Properties:released,Properties:runtime
MOVIE_1,Movie,The Matrix,1999,136
```

#### Relationships / Edges

```
Id,Label,FromId,ToId,Properties:name[_type],...
```

| Column | Required | Description |
|---|---|---|
| `Id` | Yes | Unique identifier within the dataset. |
| `Label` | Yes | Edge label. |
| `FromId` | Yes | Matches the `Id` of the source node CSV row. Resolved to the database vertex ID via the loader's ID mapping. |
| `ToId` | Yes | Matches the `Id` of the target node CSV row. |
| `Properties:*` | 0+ | Same as nodes. |

### ID Mapping Strategy

Graph databases assign their own internal IDs at write time. The CSV uses application-level string IDs (`MOVIE_1`, `1`, `DRUG_00001`). The loader must translate these during relationship loading.

**Approach — embed-and-read:**

1. For each node record, inject `_csv_source_id = csv_row["Id"]` into the properties dict before calling `connector.bulk.bulk_create_vertices(label, records)`.
2. After the call, each returned `Vertex` carries `_csv_source_id` in its `properties`. Build mapping: `{vertex.properties["_csv_source_id"]: vertex.id}`.
3. When loading relationships, resolve `FromId` and `ToId` through this mapping before calling `connector.bulk.bulk_create_edges(...)`.
4. Whether to keep or remove `_csv_source_id` from the database is controlled by `LoaderConfig.keep_source_ids` (default `True` — it is useful metadata for subsequent loads and debugging).

**Why not positional matching?**

UNWIND in Cypher and union traversals in Gremlin do not guarantee that returned records are in the same order as the input batch. Embedding the ID in properties and reading it back is the only reliable cross-database approach.

**Why not a new queryset method?**

Adding a load-specific method to `BaseBulkQuerySet` would leak loader concerns (CSV IDs, mapping) into the connector layer, whose responsibility is query execution only. The loader is the right place for this orchestration.

### Class and API Design

#### `LoaderConfig`

```python
@dataclass
class LoaderConfig:
    batch_size: int = 500
    keep_source_ids: bool = True           # keep _csv_source_id property in DB
    skip_on_error: bool = False            # skip invalid rows vs. abort
    dry_run: bool = False                  # parse and validate only, no DB writes
    source_id_property: str = "_csv_source_id"  # property name for original CSV Id
```

#### `LoaderStats`

```python
@dataclass
class LoaderStats:
    vertices_created: int = 0
    edges_created: int = 0
    vertices_failed: int = 0
    edges_failed: int = 0
    vertices_by_label: dict[str, int]      # label → count
    edges_by_label: dict[str, int]
    errors: list[str]
    duration_seconds: float = 0.0
    dry_run: bool = False
```

#### `CSVLoader`

```python
class CSVLoader:
    def __init__(self, connector: BaseConnector, config: LoaderConfig | None = None) -> None: ...

    async def load_directory(self, path: str | Path) -> LoaderStats:
        """
        Load all CSVs from a directory that follows the layout:
            <path>/nodes/         → one CSV per vertex label
            <path>/relationships/ → one CSV per edge label
        Nodes are loaded before relationships. Both subdirectories are optional.
        """

    async def load_nodes_file(self, path: str | Path, label: str | None = None) -> LoaderStats:
        """Load a single node CSV. ``label`` overrides the Label column."""

    async def load_edges_file(self, path: str | Path, label: str | None = None) -> LoaderStats:
        """Load a single edge CSV. ``label`` overrides the Label column."""

    async def __aenter__(self) -> "CSVLoader": ...
    async def __aexit__(self, *args) -> None: ...
```

The loader is connector-agnostic: it calls only `connector.bulk.bulk_create_vertices` and `connector.bulk.bulk_create_edges` from the `BaseBulkQuerySet` interface. No Cypher or Gremlin code lives in the loader.

#### Usage Examples

```python
# Load a full dataset
from invana.graph.loaders import CSVLoader, LoaderConfig
from invana.graph.connectors import OpenCypherConnector

async with OpenCypherConnector("bolt://localhost:7687", username="neo4j", password="password") as conn:
    loader = CSVLoader(conn, LoaderConfig(batch_size=1000))
    stats = await loader.load_directory("datasets/air-routes")
    print(f"Loaded {stats.vertices_created} vertices, {stats.edges_created} edges")

# Load a single file
stats = await loader.load_nodes_file("datasets/movies/nodes/movie.csv")

# Dry run via config
loader = CSVLoader(conn, LoaderConfig(dry_run=True))
stats = await loader.load_directory("datasets/drug-interactions")
```

#### Internal Processing Flow

```
load_directory(path)
  ├── discover nodes/*.csv and relationships/*.csv
  ├── for each nodes CSV (sorted alphabetically):
  │     parse_csv_nodes()         → list[dict]   # {id, label, properties}
  │     resolve_labels()           → group by label
  │     for each label:
  │       inject _csv_source_id into each properties dict
  │       chunk into batches of config.batch_size
  │       connector.bulk.bulk_create_vertices(label, batch)
  │       build id_mapping from returned Vertex.properties["_csv_source_id"]
  │       update LoaderStats
  └── for each relationships CSV (sorted alphabetically):
        parse_csv_edges()          → list[dict]   # {id, label, from_id, to_id, properties}
        resolve from_id / to_id via id_mapping
        log/skip unresolvable references depending on skip_on_error
        group by label
        chunk into batches
        connector.bulk.bulk_create_edges(label, batch)
        update LoaderStats
```

### Property Parsing — Column Name Convention

Column headers follow the pattern `Properties:<name>[_<type>]`:

```
Properties:code_string   → property name "code",  type string
Properties:runways_int   → property name "runways", type int
Properties:lat_double    → property name "lat",    type double/float
Properties:title         → property name "title",  type auto-inferred
```

Parser logic:

```python
def _parse_column_name(col: str) -> tuple[str, str | None]:
    """Returns (property_name, type_hint_or_None)."""
    base = col.removeprefix("Properties:")
    known_suffixes = {"string", "int", "long", "double", "float", "bool"}
    parts = base.rsplit("_", 1)
    if len(parts) == 2 and parts[1].lower() in known_suffixes:
        return parts[0], parts[1].lower()
    return base, None
```

### Impact on `BaseBulkQuerySet`

No changes are needed to `BaseBulkQuerySet` or any connector implementation. The loader is a pure consumer of the existing `bulk_create_vertices` / `bulk_create_edges` interface.

However, there is one **observable contract requirement**: both `OpenCypherBulkQuerySet` and `GremlinBulkQuerySet` must return the full property dict (including injected properties) in each returned `Vertex`/`Edge`. This is already true for the Cypher implementation (RETURN includes SET properties). The Gremlin implementation should be verified. If a Gremlin implementation strips unknown properties, the loader's ID mapping will silently break.

This is a test-time concern and does not require an API change.

### Impact on Existing Datasets

All three dataset directories (`air-routes`, `movies`, `drug-interactions`) already conform to the format spec above. No dataset regeneration is needed.

The `usage_example.py` files in each dataset should be updated after implementation to use `CSVLoader` as the canonical example.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Separate `CypherCSVLoader` / `GremlinCSVLoader` (old arch) | Allows DB-specific optimisations per loader | Duplicates all CSV parsing logic; forces users to know which dialect they're using | `BaseBulkQuerySet` already abstracts the dialect — the loader doesn't need to care |
| `bulk_load_vertices(label, records_with_source_id)` method on queryset | Clean interface, mapping visible at queryset level | Leaks loader semantics (source IDs) into a query execution layer | Connector layer should only execute queries, not manage load-time ID tracking |
| Positional matching (record order in = record order out) | No property injection needed | UNWIND and Gremlin union traversals both have undefined output order | Not safe across databases |
| Pandas / Polars for CSV parsing | Fast, type-safe, rich dtype support | Heavy dependency for a simple load operation; datasets are small enough for stdlib `csv` | Standard library is sufficient; avoids mandatory dependency on data-frame libraries |
| Loader inside connector queryset (embed in `BaseBulkQuerySet`) | One place for bulk operations | Queryset reads files, owns stats, orchestrates batches — violates single responsibility | Architecture boundary: connectors execute queries; loaders own data ingestion |

## Security Considerations

- **Path traversal**: `load_directory` accepts user-supplied paths. Validate that the resolved path is a directory and that all discovered files are within it using `Path.resolve()` comparison.
- **CSV injection**: Property values from CSV files reach the graph database only through the connector's parameterized query interface — no string interpolation into query strings. This is safe by construction.
- **Resource exhaustion**: Very large CSVs could read the entire file into memory before batching. The implementation should stream-read rows and flush to batches rather than collecting all rows first.

## Performance Considerations

- **Batch size tuning**: Default `batch_size=500` is reasonable for both Cypher (UNWIND handles large batches well) and Gremlin (union traversals have message-size limits). Callers load large datasets should use `LoaderConfig(batch_size=1000)` for Neo4j/Memgraph and `batch_size=50–100` for JanusGraph over WebSocket.
- **Memory**: The `id_mapping` dict grows to O(total nodes). For the `air-routes` dataset (~4 000 nodes) this is negligible. For future large datasets (100k+ nodes) this might need a disk-backed mapping.
- **Parallelism**: Not in scope for v1. Node files for different labels are independent and could be parallelised, but the added complexity of merging ID maps is not worth it for initial implementation.

## Testing Strategy

- **Unit tests** (no DB, `engine/tests/loaders/`):
  - CSV column name parsing: typed suffixes, untyped, edge cases (empty value, `_` in property name)
  - Type coercion: string/int/float/bool conversion and edge cases
  - Directory discovery: only `nodes/` exists, only `relationships/` exists, both, neither
  - ID mapping: unresolvable `FromId`/`ToId` with `skip_on_error=True` and `False`
  - Dry run: no calls to connector methods
  - Stats accumulation across multiple files

- **Integration tests** per connector (in `integrations/invana-neo4j/tests/`, etc.):
  - Load `datasets/movies` and assert vertex/edge counts
  - Verify `_csv_source_id` property is present when `keep_source_ids=True`
  - Verify `_csv_source_id` is absent when `keep_source_ids=False`
  - Load the same dataset twice (expected: duplicate records created — idempotency via `bulk_upsert_*` is deferred to v2)

- **Coverage target**: ≥ 80% (matching project standard)

## Decisions Made

1. **`clean_before_load` dropped**: Clearing the graph before a load is the caller's responsibility. Adding it to `LoaderConfig` would embed infrastructure-level concerns inside a data-ingestion class. Callers that need a clean slate should use the connector's own bulk-delete methods before constructing the loader.

2. **No upsert in v1**: `CSVLoader` uses `bulk_create_vertices` / `bulk_create_edges` (CREATE semantics) only. MERGE-style idempotency is a v2 feature; the scaffolding exists via `bulk_upsert_vertices` / `bulk_upsert_edges` on `BaseBulkQuerySet`, which currently raise `NotImplementedError`.

3. **YAML manifest deferred**: The directory convention (nodes-before-relationships, alphabetical sort within each) is sufficient for all current datasets. A manifest can be added in v2 if complex load-order or label-override requirements arise.

4. **`keep_source_ids=True` default**: The `_csv_source_id` property is useful for traceability and subsequent incremental loads. The loader omits it at write time when `keep_source_ids=False`; no post-load DELETE pass is needed or implemented.

## Implementation Plan

| Step | Scope | Notes |
|---|---|---|
| 1. `LoaderConfig` + `LoaderStats` dataclasses | `engine/src/invana/graph/loaders/csv.py` | No DB dependency |
| 2. CSV parsing helpers | same file | `_parse_column_name`, `_coerce_value`, `_parse_node_row`, `_parse_edge_row` |
| 3. `CSVLoader.load_nodes_file` | same file | calls `connector.bulk.bulk_create_vertices`, builds `id_mapping` |
| 4. `CSVLoader.load_edges_file` | same file | resolves IDs from `id_mapping`, calls `connector.bulk.bulk_create_edges` |
| 5. `CSVLoader.load_directory` | same file | auto-discovery, delegates to steps 3+4 |
| 6. Unit tests | `engine/tests/graph/loaders/` | Fully standalone, no DB |
| 7. Update `datasets/*/usage_example.py` | `datasets/` | Use `CSVLoader` as canonical example |
| 8. Integration tests | `integrations/invana-neo4j/tests/` | Load movies dataset, assert counts |
