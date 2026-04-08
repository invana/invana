# RFC-001: Graph Connectors Module

> **Status**: Draft
> **Author**: Ravi Merugu
> **Created**: 2026-04-08
> **Updated**: 2026-04-08

## Summary

The engine's `graph/connectors/` module provides two concrete connector implementations — `OpenCypherConnector` (openCypher) and `GremlinConnector` (Apache TinkerPop) — built on top of shared base ABCs. These connectors include fully working querysets for data reading, writing, schema management, algorithms, bulk operations, and vector search using standard query language features. The engine has **zero knowledge** of any specific database vendor.

Each integration package (`invana-neo4j`, `invana-memgraph`, etc.) subclasses the appropriate language connector to provide only: (1) driver creation and auth, (2) vendor-specific queryset overrides where the standard language implementation is insufficient (e.g., Neo4j GDS algorithms, Memgraph MAGE, vendor-specific schema DDL).

## Motivation

- **Unified API** — Application code and Studio should not care whether the backend is Neo4j, Memgraph, JanusGraph, or Neptune. A single `connector.<queryset>.<method>()` interface abstracts all differences.
- **DB-native performance** — Algorithms, schema DDL, and vector search vary wildly across vendors. Integrations must be able to override base implementations with vendor-native procedures (e.g., Neo4j GDS, Memgraph MAGE) without changing the public API.
- **Extensibility** — New databases can be supported by adding an integration package that subclasses the appropriate language connector. No engine changes required.
- **If we don't do this** — Every feature (query workspace, simulation engine, algorithm runner) would need per-database branching, making the codebase unmaintainable.

## Design

### Module Location

```
engine/src/invana/graph/connectors/
```

### Directory Structure

```
graph/
├── __init__.py
└── connectors/
    ├── __init__.py
    ├── base/
    │   ├── __init__.py
    │   ├── connector.py           # BaseConnector ABC
    │   ├── constants.py           # Capability, QueryLanguage enums
    │   ├── decorators.py          # @not_supported_by_vendor
    │   ├── exceptions.py          # ConnectorError, NotSupportedError, etc.
    │   ├── data_types/
    │   │   ├── __init__.py
    │   │   ├── data_elements.py   # Vertex, Edge, Path, GraphResponse, QueryResult
    │   │   ├── schema_elements.py # NodeType, EdgeType, PropertyDefinition, IndexInfo, ConstraintInfo
    │   │   ├── filters.py         # FilterExpression, LogicalOp
    │   │   └── filter_types.py    # FilterOp enum (eq, gt, lt, contains, in, etc.)
    │   ├── querysets/
    │   │   ├── __init__.py
    │   │   ├── base.py            # BaseQuerySet (holds connector ref)
    │   │   ├── data_reader.py     # BaseDataReaderQuerySet ABC
    │   │   ├── data_writer.py      # BaseDataWriterQuerySet ABC
    │   │   ├── schema_reader.py   # BaseSchemaReaderQuerySet ABC
    │   │   ├── schema_writer.py   # BaseSchemaWriterQuerySet ABC
    │   │   ├── bulk.py            # BaseBulkQuerySet ABC
    │   │   ├── algorithms.py      # BaseAlgorithmsQuerySet ABC
    │   │   └── vector.py          # BaseVectorQuerySet ABC
    │   └── serializers.py         # BaseSerializer ABC
    ├── cypher/
    │   ├── __init__.py
    │   ├── connector.py           # OpenCypherConnector(BaseConnector) — concrete
    │   ├── serializers.py         # OpenCypherSerializer(BaseSerializer) — concrete
    │   ├── query_builder.py       # Cypher AST → parameterized string
    │   └── querysets/             # All concrete — standard openCypher implementations
    │       ├── __init__.py
    │       ├── base.py            # OpenCypherQuerySet(BaseQuerySet)
    │       ├── data_reader.py     # OpenCypherDataReaderQuerySet
    │       ├── data_writer.py      # OpenCypherDataWriterQuerySet
    │       ├── schema_reader.py   # OpenCypherSchemaReaderQuerySet
    │       ├── schema_writer.py   # OpenCypherSchemaWriterQuerySet
    │       ├── bulk.py            # OpenCypherBulkQuerySet
    │       ├── algorithms.py      # OpenCypherAlgorithmsQuerySet
    │       └── vector.py          # OpenCypherVectorQuerySet
    └── gremlin/
        ├── __init__.py
        ├── connector.py           # GremlinConnector(BaseConnector) — concrete
        ├── serializers.py         # GremlinSerializer(BaseSerializer) — concrete
        ├── query_builder.py       # Gremlin traversal builder
        └── querysets/             # All concrete — standard Gremlin implementations
            ├── __init__.py
            ├── base.py
            ├── data_reader.py
            ├── data_writer.py
            ├── schema_reader.py
            ├── schema_writer.py
            ├── bulk.py
            ├── algorithms.py
            └── vector.py
```

Integration packages extend this:

```
integrations/invana-neo4j/src/invana_neo4j/
├── __init__.py
├── connector.py           # Neo4jConnector(OpenCypherConnector)
├── serializers.py         # Neo4jSerializer(OpenCypherSerializer) — if needed
└── querysets/
    ├── schema_reader.py   # Neo4j-specific: SHOW CONSTRAINTS, SHOW INDEXES
    ├── schema_writer.py   # Neo4j-specific: CREATE CONSTRAINT ... FOR (n:Label) ...
    ├── algorithms.py      # GDS library: CALL gds.pageRank.stream(...)
    └── vector.py          # CALL db.index.vector.queryNodes(...)
```

### Inheritance Model

The engine provides two layers: abstract base and concrete language implementations. Integration packages form the third layer.

**What lives in the engine (`invana` core package):**

```
BaseConnector (ABC)
├── OpenCypherConnector — concrete openCypher implementation
└── GremlinConnector — concrete TinkerPop implementation
```

`OpenCypherConnector` and `GremlinConnector` are **not abstract** — they are fully functional connectors with complete queryset implementations using standard openCypher / Gremlin syntax. The only abstract methods left for integrations are `_create_driver()`, `_close_driver()`, `execute()`, and `health_check()` — i.e., the driver lifecycle that requires the vendor-specific client library.

**What lives in integration packages (`invana-neo4j`, etc.):**

```
OpenCypherConnector
├── Neo4jConnector          — invana-neo4j (driver: neo4j>=5.0)
├── MemgraphConnector       — invana-memgraph (driver: neo4j>=5.0, Bolt-compatible)
└── ArcadeDBOpenCypherConnector — invana-arcadedb (driver: HTTP client)

GremlinConnector
├── JanusGraphConnector      — invana-janusgraph (driver: gremlinpython>=3.7)
├── NeptuneConnector         — invana-neptune (driver: gremlinpython + boto3)
├── TinkerGraphConnector     — invana-tinkergraph (driver: gremlinpython>=3.7)
└── ArcadeDBGremlinConnector — invana-arcadedb (driver: gremlinpython>=3.7)
```

Integrations implement `_create_driver()` / `_close_driver()` / `execute()` / `health_check()` and optionally override specific querysets.

**Queryset inheritance:**

```
BaseQuerySet (ABC)
├── BaseDataReaderQuerySet (ABC)
│   ├── OpenCypherDataReaderQuerySet  ← concrete, uses openCypher
│   └── GremlinDataReaderQuerySet ← concrete, uses Gremlin
├── BaseDataWriterQuerySet (ABC)
│   ├── OpenCypherDataWriterQuerySet
│   └── GremlinDataWriterQuerySet
├── BaseSchemaReaderQuerySet (ABC)
│   ├── OpenCypherSchemaReaderQuerySet  ← works for standard openCypher
│   │   └── (Neo4j/Memgraph override only if vendor DDL differs)
│   └── GremlinSchemaReaderQuerySet
│       └── (JanusGraph override for Management API)
├── BaseSchemaWriterQuerySet (ABC)
│   ├── OpenCypherSchemaWriterQuerySet
│   └── GremlinSchemaWriterQuerySet
├── BaseBulkQuerySet (ABC)
│   ├── OpenCypherBulkQuerySet
│   └── GremlinBulkQuerySet
├── BaseAlgorithmsQuerySet (ABC) — all algos defined here
│   ├── OpenCypherAlgorithmsQuerySet  ← openCypher APOC-style defaults
│   │   └── (Neo4j overrides with GDS, Memgraph overrides with MAGE)
│   └── GremlinAlgorithmsQuerySet
└── BaseVectorQuerySet (ABC)
    ├── OpenCypherVectorQuerySet  ← @not_supported_by_vendor by default
    │   └── (Neo4j overrides with native vector index support)
    └── GremlinVectorQuerySet ← @not_supported_by_vendor by default
        └── (Neptune overrides with native vector support)
```

The Cypher/Gremlin querysets are **concrete and fully working**. Integrations only subclass the specific querysets they need to override — everything else is inherited as-is.

### Data Model

All data types are Pydantic v2 models in `base/data_types/`.

#### Data Elements (`data_elements.py`)

```python
class Vertex(BaseModel):
    id: str
    label: str
    properties: dict[str, Any] = {}

class Edge(BaseModel):
    id: str
    label: str
    source: str
    target: str
    properties: dict[str, Any] = {}

class Path(BaseModel):
    vertices: list[Vertex]
    edges: list[Edge]

class ResultMetadata(BaseModel):
    node_count: int = 0
    edge_count: int = 0
    record_count: int = 0
    duration_ms: float = 0.0

class GraphResponse(BaseModel):
    nodes: list[Vertex] = []
    edges: list[Edge] = []
    records: list[dict[str, Any]] = []
    metadata: ResultMetadata = ResultMetadata()

class QueryResult(BaseModel):
    id: str
    status: Literal["completed", "error"]
    duration_ms: float
    language: Literal["cypher", "gremlin"]
    result: GraphResponse | None = None
    error: str | None = None
```

#### Schema Elements (`schema_elements.py`)

```python
class PropertyDefinition(BaseModel):
    name: str
    type: str   # "string", "integer", "float", "boolean", "datetime", "list[T]"
    required: bool = False
    unique: bool = False

class NodeType(BaseModel):
    name: str
    description: str = ""
    properties: list[PropertyDefinition] = []

class EdgeType(BaseModel):
    name: str
    description: str = ""
    source: str
    target: str
    properties: list[PropertyDefinition] = []
    cardinality: Literal["one-to-one", "one-to-many", "many-to-many"] = "many-to-many"

class IndexInfo(BaseModel):
    name: str
    label: str
    properties: list[str]
    type: Literal["btree", "fulltext", "vector", "composite"]

class ConstraintInfo(BaseModel):
    name: str
    label: str
    properties: list[str]
    type: Literal["unique", "exists", "node_key"]
```

#### Filter Types (`filter_types.py`, `filters.py`)

```python
class FilterOp(str, Enum):
    EQ = "eq"
    NEQ = "neq"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"

class LogicalOp(str, Enum):
    AND = "and"
    OR = "or"

class FilterExpression(BaseModel):
    property: str
    op: FilterOp
    value: Any = None

class FilterGroup(BaseModel):
    """Recursive filter tree supporting nested AND/OR groups."""
    operator: LogicalOp = LogicalOp.AND
    conditions: list[FilterExpression | "FilterGroup"] = []
```

### Constants (`constants.py`)

```python
class QueryLanguage(str, Enum):
    CYPHER = "cypher"
    GREMLIN = "gremlin"

class Capability(str, Enum):
    CYPHER = "cypher"
    GREMLIN = "gremlin"
    VECTOR_SEARCH = "vector_search"
    FULLTEXT_INDEX = "fulltext_index"
    SCHEMA_ENFORCEMENT = "schema_enforcement"
    TRANSACTIONS = "transactions"
```

### Exceptions (`exceptions.py`)

```python
class ConnectorError(Exception):
    """Base exception for all connector errors."""

class ConnectionError(ConnectorError):
    """Failed to connect or lost connection."""

class QueryExecutionError(ConnectorError):
    """Query failed during execution."""

class NotSupportedError(ConnectorError):
    """Feature not supported by this connector/vendor."""

class SerializationError(ConnectorError):
    """Failed to serialize/deserialize results."""
```

### BaseConnector (`connector.py`)

```python
class BaseConnector(ABC):
    """
    Access: connector.<queryset>.<method>()
    Lifecycle: async context manager or explicit connect()/disconnect().
    """
    data_reader: "BaseDataReaderQuerySet"
    data_writer: "BaseDataWriterQuerySet"
    schema_reader: "BaseSchemaReaderQuerySet"
    schema_writer: "BaseSchemaWriterQuerySet"
    bulk: "BaseBulkQuerySet"
    algorithms: "BaseAlgorithmsQuerySet"
    vector: "BaseVectorQuerySet | None"   # None if DB lacks support

    def __init__(self, uri: str, *, pool_size: int = 10, **kwargs):
        self._uri = uri
        self._pool_size = pool_size
        self._driver: Any = None
        self._connected: bool = False
        self._serializer = self._create_serializer()
        self._init_querysets()

    @abstractmethod
    def _create_serializer(self) -> "BaseSerializer": ...

    @abstractmethod
    def _init_querysets(self) -> None:
        """Wire up self.data_reader, self.data_writer, self.schema_reader, etc."""

    # --- These 4 are what integration packages implement ---
    @abstractmethod
    async def _create_driver(self) -> Any:
        """Create the vendor-specific driver instance (e.g., neo4j.AsyncDriver)."""

    @abstractmethod
    async def _close_driver(self) -> None:
        """Close the vendor-specific driver."""

    @abstractmethod
    async def execute(self, query: str, parameters: dict | None = None) -> Any:
        """Execute a raw query via the vendor driver. This is the only method
        that touches the wire protocol. All querysets call this."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify the connection is alive."""
    # --- End of integration-implemented methods ---

    @abstractmethod
    def capabilities(self) -> set[Capability]: ...

    async def connect(self) -> None:
        self._driver = await self._create_driver()
        self._connected = True
        await self.health_check()

    async def disconnect(self) -> None:
        if self._driver:
            await self._close_driver()
            self._connected = False

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *exc):
        await self.disconnect()
```

### BaseQuerySet (`querysets/base.py`)

```python
class BaseQuerySet:
    def __init__(self, connector: "BaseConnector"):
        self._connector = connector

    @property
    def _serializer(self) -> "BaseSerializer":
        return self._connector._serializer
```

### Queryset ABCs

#### DataReader (`querysets/data_reader.py`)

```python
class BaseDataReaderQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def read_vertices(
        self, label: str, *,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Vertex]: ...

    @abstractmethod
    async def read_edges(
        self, label: str, *,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> list[Edge]: ...

    @abstractmethod
    async def read_neighbors(
        self, vertex_id: str, *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        limit: int | None = None,
    ) -> GraphResponse: ...

    @abstractmethod
    async def read_vertex_by_id(self, vertex_id: str) -> Vertex: ...

    @abstractmethod
    async def read_edge_by_id(self, edge_id: str) -> Edge: ...

    @abstractmethod
    async def shortest_path(
        self, source_id: str, target_id: str, *,
        max_depth: int = 10,
    ) -> Path | None: ...

    @abstractmethod
    async def count_vertices(self, label: str | None = None) -> int: ...

    @abstractmethod
    async def count_edges(self, label: str | None = None) -> int: ...
```

#### DataWriter (`querysets/data_writer.py`)

```python
class BaseDataWriterQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def create_vertex(self, label: str, properties: dict) -> Vertex: ...

    @abstractmethod
    async def create_edge(
        self, label: str, source_id: str, target_id: str,
        properties: dict | None = None,
    ) -> Edge: ...

    @abstractmethod
    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex: ...

    @abstractmethod
    async def update_edge(self, edge_id: str, properties: dict) -> Edge: ...

    @abstractmethod
    async def delete_vertex(self, vertex_id: str) -> None: ...

    @abstractmethod
    async def delete_edge(self, edge_id: str) -> None: ...
```

#### SchemaReader (`querysets/schema_reader.py`)

```python
class BaseSchemaReaderQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def get_node_labels(self) -> list[str]: ...

    @abstractmethod
    async def get_edge_labels(self) -> list[str]: ...

    @abstractmethod
    async def get_property_keys(self, label: str) -> list[str]: ...

    @abstractmethod
    async def get_indexes(self) -> list[IndexInfo]: ...

    @abstractmethod
    async def get_constraints(self) -> list[ConstraintInfo]: ...
```

#### SchemaWriter (`querysets/schema_writer.py`)

```python
class BaseSchemaWriterQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def create_index(
        self, label: str, properties: list[str], *,
        index_type: Literal["btree", "fulltext", "composite"] = "btree",
        name: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def drop_index(self, name: str) -> None: ...

    @abstractmethod
    async def create_constraint(
        self, label: str, properties: list[str], *,
        constraint_type: Literal["unique", "exists", "node_key"] = "unique",
        name: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def drop_constraint(self, name: str) -> None: ...
```

#### Bulk (`querysets/bulk.py`)

```python
class BaseBulkQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def bulk_create_vertices(
        self, label: str, records: list[dict],
    ) -> list[Vertex]: ...

    @abstractmethod
    async def bulk_create_edges(
        self, label: str, records: list[dict],
    ) -> list[Edge]: ...

    @abstractmethod
    async def bulk_delete_vertices(self, vertex_ids: list[str]) -> int: ...

    @abstractmethod
    async def bulk_delete_edges(self, edge_ids: list[str]) -> int: ...
```

#### Algorithms (`querysets/algorithms.py`)

All algorithms are defined in the base class. Integration packages override with DB-native implementations; unsupported algorithms use `@not_supported_by_vendor`.

```python
class BaseAlgorithmsQuerySet(BaseQuerySet, ABC):
    # -- Centrality --
    @abstractmethod
    async def pagerank(
        self, *, node_label: str, edge_label: str,
        damping_factor: float = 0.85, max_iterations: int = 20,
        tolerance: float = 1e-6,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def betweenness_centrality(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def closeness_centrality(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def degree_centrality(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def eigenvector_centrality(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    # -- Community Detection --
    @abstractmethod
    async def louvain(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def label_propagation(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def connected_components(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def strongly_connected_components(
        self, *, node_label: str, edge_label: str,
    ) -> list[dict[str, Any]]: ...

    # -- Pathfinding --
    @abstractmethod
    async def dijkstra(
        self, *, source_id: str, target_id: str,
        weight_property: str = "weight",
    ) -> Path | None: ...

    @abstractmethod
    async def a_star(
        self, *, source_id: str, target_id: str,
        weight_property: str = "weight",
        latitude_property: str = "latitude",
        longitude_property: str = "longitude",
    ) -> Path | None: ...

    @abstractmethod
    async def all_shortest_paths(
        self, *, source_id: str, target_id: str,
    ) -> list[Path]: ...

    @abstractmethod
    async def bfs(
        self, *, source_id: str, target_label: str | None = None,
        max_depth: int = 10,
    ) -> list[Vertex]: ...

    # -- Similarity --
    @abstractmethod
    async def jaccard_similarity(
        self, *, node_label: str, edge_label: str, top_k: int = 10,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def cosine_similarity(
        self, *, node_label: str, property_name: str, top_k: int = 10,
    ) -> list[dict[str, Any]]: ...
```

#### Vector (`querysets/vector.py`)

```python
class BaseVectorQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def create_vector_index(
        self, label: str, property_name: str, *,
        dimensions: int,
        similarity: Literal["cosine", "euclidean"] = "cosine",
        name: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def drop_vector_index(self, name: str) -> None: ...

    @abstractmethod
    async def similarity_search(
        self, label: str, embedding: list[float], *,
        top_k: int = 10,
        property_name: str = "embedding",
    ) -> list[Vertex]: ...
```

### Serializer Layer

Serializers live per language layer in engine and are **concrete** — they handle the standard result format for each query language. Integration packages subclass only if a vendor's raw output format deviates from the standard driver format.

```python
# base/serializers.py
class BaseSerializer(ABC):
    @abstractmethod
    def deserialize_vertex(self, raw: Any) -> Vertex: ...

    @abstractmethod
    def deserialize_edge(self, raw: Any) -> Edge: ...

    @abstractmethod
    def deserialize_path(self, raw: Any) -> Path: ...

    @abstractmethod
    def deserialize_graph_response(self, raw: Any) -> GraphResponse: ...

# cypher/serializers.py
class OpenCypherSerializer(BaseSerializer):
    """Concrete. Handles Bolt protocol record format → Pydantic models.
    Works with any Bolt-compatible driver (neo4j-python for Neo4j & Memgraph)."""

    def deserialize_vertex(self, raw: Any) -> Vertex:
        # Bolt Node record → Vertex
        ...

# gremlin/serializers.py
class GremlinSerializer(BaseSerializer):
    """Concrete. Handles gremlinpython result format → Pydantic models.
    Works with any TinkerPop-compatible server."""

    def deserialize_vertex(self, raw: Any) -> Vertex:
        # gremlinpython dict → Vertex
        ...
```

### Decorator: `@not_supported_by_vendor`

```python
# base/decorators.py
def not_supported_by_vendor(message: str = ""):
    """Decorator for methods not supported by a specific DB vendor.
    Raises NotSupportedError at call time with a descriptive message."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            raise NotSupportedError(
                f"'{func.__name__}' is not supported by this connector. {message}"
            )
        return wrapper
    return decorator
```

Usage in integration packages:

```python
# invana-memgraph: Memgraph has no vector search
class MemgraphVectorQuerySet(OpenCypherVectorQuerySet):
    @not_supported_by_vendor("Memgraph does not support vector indexes.")
    async def create_vector_index(self, *args, **kwargs): ...

    @not_supported_by_vendor("Memgraph does not support vector search.")
    async def similarity_search(self, *args, **kwargs): ...
```

### Query Builder (AST → String)

Standard queryset operations build queries through the query builder, not raw strings. This provides parameterized queries (injection-safe) and a single place to maintain query generation logic.

```python
# cypher/query_builder.py
class OpenCypherQueryBuilder:
    @staticmethod
    def match_nodes(
        label: str,
        filters: FilterGroup | None,
        limit: int | None,
        offset: int | None,
    ) -> tuple[str, dict]:
        """Returns (cypher_query, parameters) tuple. Always parameterized."""
        ...

    @staticmethod
    def create_node(label: str, properties: dict) -> tuple[str, dict]: ...

    @staticmethod
    def match_neighbors(
        vertex_id: str, direction: str, edge_label: str | None, limit: int | None,
    ) -> tuple[str, dict]: ...
```

`connector.execute()` remains available for raw pass-through when the AST is insufficient for advanced queries.

### Connection Pooling (Hybrid)

- **Driver-managed**: The underlying driver (`neo4j.AsyncGraphDatabase.driver`, `gremlinpython`) owns the TCP connection pool, respecting `pool_size`.
- **Engine-managed lifecycle**: `BaseConnector` manages `connect()` / `disconnect()` / `health_check()` and async context manager support. The engine can monitor connection state, implement reconnection logic, and track pool metrics.
- **Why hybrid**: Driver pools are battle-tested for their specific wire protocols. Adding our own pool on top gains nothing. But lifecycle (startup probe, graceful shutdown, health monitoring) belongs to the engine.

### Async Strategy

All queryset methods are `async def`. No sync wrappers.

### Data Flow

The engine querysets generate queries and call `self._connector.execute()`. They don't know or care which vendor is on the other end — that's determined by which integration's connector subclass was instantiated.

```
User / API / Studio
    │
    ▼
connector.data_reader.read_vertices("Person", filters=..., limit=25)
    │
    ▼
OpenCypherDataReaderQuerySet.read_vertices()          ← lives in ENGINE
    │  1. Build query → OpenCypherQueryBuilder.match_nodes(...)     ← ENGINE
    │     → ("MATCH (n:Person) WHERE n.born > $p0 RETURN n LIMIT $limit", {"p0": 1990, "limit": 25})
    │
    │  2. Execute → self._connector.execute(query, params)
    │     → this calls the INTEGRATION's execute() implementation:
    │       Neo4jConnector.execute()  → neo4j async driver → Bolt → Neo4j
    │       — OR —
    │       MemgraphConnector.execute() → neo4j driver → Bolt → Memgraph
    │
    │  3. Deserialize → OpenCypherSerializer.deserialize_vertex()   ← ENGINE
    │
    ▼
list[Vertex]
```

For vendor-specific overrides (e.g., algorithms):

```
connector.algorithms.pagerank(node_label="Person", edge_label="KNOWS")
    │
    ▼
Neo4jAlgorithmsQuerySet.pagerank()      ← lives in INTEGRATION (overrides engine default)
    │  1. Build GDS-specific query: CALL gds.pageRank.stream(...)   ← INTEGRATION
    │  2. Execute → self._connector.execute(...)                     ← INTEGRATION's driver
    │  3. Deserialize → self._serializer.deserialize_vertex()        ← ENGINE serializer
    │
    ▼
list[dict]
```

### API Surface

The connector module is internal to the engine. It's consumed by the FastAPI API layer, not exposed directly. API endpoints are out of scope for this RFC.

### Storage

No persistent storage. Connectors are stateless beyond the connection pool. Connection configurations are stored in the engine's app state DB (separate concern).

### Dependencies

**Engine core** (no new external deps — connectors are abstract):
- `pydantic>=2.0` (already an engine dependency via FastAPI)

**Integration packages** (already declared in their `pyproject.toml`):
- `invana-neo4j`: `neo4j>=5.0`
- `invana-memgraph`: `neo4j>=5.0` (Bolt-compatible)
- `invana-janusgraph`: `gremlinpython>=3.7`
- `invana-neptune`: `gremlinpython>=3.7`, `boto3>=1.35`
- `invana-tinkergraph`: `gremlinpython>=3.7`
- `invana-arcadedb`: `gremlinpython>=3.7` (Gremlin mode), HTTP client (Cypher mode)

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Flat connector (no language layer) | Simpler hierarchy | Massive code duplication between Neo4j and Memgraph (both Cypher) | Cypher/Gremlin share 80%+ of query logic |
| Plugin registry for querysets | Decoupled, hot-swappable | Over-engineered for a known set of DBs; harder to debug; IDE can't resolve types | Subclass + mixin is simpler and type-safe |
| All connectors in engine | Single package install | Forces neo4j/gremlinpython as engine deps even if unused; bloats core | Separate packages keep core lightweight |
| Query DSL (ORM-style) | Nice API like `Vertex.objects.filter(born__gt=1990)` | Leaky abstraction for graph queries; hard to express traversals, paths, algorithms | Graph queries are fundamentally different from relational; AST + raw is more honest |
| Sync + async dual API | Convenient for scripts/CLI | Doubles maintenance surface; sync wrappers around async are fragile | CLI can use `asyncio.run()`; not worth the cost |

## Security Considerations

- **Query injection**: All queryset methods MUST use parameterized queries via the query builder. Never interpolate user input into query strings. `connector.execute()` (raw pass-through) is intended for internal/trusted use only and must not be exposed to untrusted input without sanitization at the API layer.
- **Credential handling**: Connection credentials (passwords, AWS keys) are passed at connector init and must never be logged, serialized, or included in error messages. Integration connectors must not store credentials in plain-text attributes accessible via `__dict__`.
- **Connection security**: Connectors should support TLS/SSL configuration. Neo4j `bolt+s://`, Gremlin `wss://`, Neptune SigV4 auth.

## Performance Considerations

- **Connection pooling**: Pool size defaults to 10, configurable per connector. Pools are managed by the underlying driver for optimal protocol-level multiplexing.
- **Batch operations**: `BulkQuerySet` methods should use database-native batch mechanisms (Cypher `UNWIND`, Gremlin batch traversals) rather than looping single operations.
- **Serialization overhead**: Pydantic v2 is compiled (Rust core), so deserialization of thousands of vertices should be sub-millisecond per record. Profile if query results exceed 10K records.
- **Algorithm execution**: DB-native algorithms (GDS, MAGE) run server-side and are orders of magnitude faster than fetching data + computing in Python. Always prefer native when available.

## Resolved Questions

- [x] **ArcadeDB packaging** — Single package `invana-arcadedb` containing both `ArcadeDBOpenCypherConnector` and `ArcadeDBGremlinConnector`. User picks which connector to instantiate.
- [x] **Algorithm fallback** — Deferred to a future RFC. For now, DBs without native algorithm support raise `NotSupportedError`. A Python fallback engine (NetworkX/igraph) may be added later as opt-in.
- [x] **Filter nesting** — Nested recursive `FilterGroup` tree. Supports expressions like `(A AND B) OR (C AND D)`. See updated filter model below.
- [x] **Transaction API** — Connector-level async context manager: `async with connector.transaction() as tx:`. Querysets called on `tx` use the transaction session. See updated connector design below.

### Updated: Nested Filter Model

```python
# base/data_types/filters.py
class FilterExpression(BaseModel):
    property: str
    op: FilterOp
    value: Any = None

class FilterGroup(BaseModel):
    """Recursive filter tree. Supports (A AND B) OR (C AND D)."""
    operator: LogicalOp = LogicalOp.AND
    conditions: list[FilterExpression | "FilterGroup"] = []
```

Usage:
```python
# (born > 1990 AND name STARTS_WITH "A") OR (born < 1950)
filters = FilterGroup(operator=LogicalOp.OR, conditions=[
    FilterGroup(operator=LogicalOp.AND, conditions=[
        FilterExpression(property="born", op=FilterOp.GT, value=1990),
        FilterExpression(property="name", op=FilterOp.STARTS_WITH, value="A"),
    ]),
    FilterExpression(property="born", op=FilterOp.LT, value=1950),
])
await connector.data_reader.read_vertices("Person", filters=filters)
```

### Updated: Transaction API

```python
# base/connector.py — added to BaseConnector
class BaseConnector(ABC):
    ...

    @abstractmethod
    def transaction(self) -> "AsyncContextManager[BaseConnector]":
        """Returns a transactional connector. Querysets called on the
        returned object use the transaction session.

        Usage:
            async with connector.transaction() as tx:
                vertex = await tx.data_writer.create_vertex("Person", {"name": "Alice"})
                await tx.data_writer.create_edge("KNOWS", vertex.id, bob_id)
                # auto-commits on exit, rolls back on exception
        """
        ...
```

The engine's language connectors define the transaction contract. Each integration implements it using their vendor's native driver transaction mechanism:
- **Cypher integrations**: Neo4j/Memgraph use `session.begin_transaction()` (Bolt API)
- **Gremlin integrations**: JanusGraph/Neptune use `g.tx().begin()` / `commit()` / `rollback()`

## Implementation Plan

1. [ ] **Base layer** — `base/` with all ABCs, data types, constants, decorators, exceptions
2. [ ] **Cypher layer** — `cypher/` connector, query builder, serializer, all querysets
3. [ ] **Gremlin layer** — `gremlin/` connector, query builder, serializer, all querysets
4. [ ] **Unit tests for base** — data type validation, filter construction, decorator behavior
5. [ ] **Unit tests for Cypher** — query builder output, serializer parsing (mock driver)
6. [ ] **Unit tests for Gremlin** — query builder output, serializer parsing (mock driver)
7. [ ] **invana-neo4j integration** — connector, schema querysets, algorithm querysets (GDS), vector queryset
8. [ ] **invana-neo4j integration tests** — against real Neo4j (Docker, CI)
9. [ ] **Remaining integrations** — memgraph, janusgraph, neptune, tinkergraph, arcadedb
10. [ ] **Integration tests** — per-DB Docker containers in CI

## References

- [Neo4j Python Driver (async)](https://neo4j.com/docs/python-manual/current/concurrency/)
- [Neo4j GDS Library](https://neo4j.com/docs/graph-data-science/current/)
- [Memgraph MAGE](https://memgraph.com/docs/advanced-algorithms)
- [Apache TinkerPop / Gremlin Python](https://tinkerpop.apache.org/docs/current/reference/#gremlin-python)
- [Amazon Neptune Gremlin](https://docs.aws.amazon.com/neptune/latest/userguide/access-graph-gremlin.html)
- [openCypher specification](https://opencypher.org/resources/)
