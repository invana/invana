# Schema Operations

Invana provides a unified async API for inspecting and managing database schema — indexes, constraints, labels, and property keys — across all supported graph databases. The same code works whether the backend is Neo4j, Memgraph, JanusGraph, or any other supported database.

!!! info "No vendor-specific DDL required"
    You don't need to know Neo4j's `CREATE INDEX` syntax vs. JanusGraph's Management API. The connector handles the translation.

## Prerequisites

- Invana installed (`pip install invana`)
- A connector package installed (e.g. `pip install invana-neo4j`)
- A running graph database

## Connecting

All examples assume an active connector:

```python
from invana_neo4j import Neo4jConnector

async with Neo4jConnector(
    "bolt://localhost:7687",
    username="neo4j",
    password="password",
    database="neo4j",
) as conn:
    # All operations shown below use `conn`
    ...
```

---

## Read Schema

### Get Node Labels

List all node labels that exist in the database:

```python
labels = await conn.schema_reader.get_node_labels()

print(labels)  # ["Person", "Movie", "Genre"]
```

### Get Edge Labels

List all relationship types:

```python
edge_labels = await conn.schema_reader.get_edge_labels()

print(edge_labels)  # ["ACTED_IN", "DIRECTED", "IN_GENRE"]
```

### Get Property Keys

Discover the distinct property keys used on a given label:

```python
person_keys = await conn.schema_reader.get_property_keys("Person")

print(person_keys)  # ["name", "born", "nationality"]
```

### Get Indexes

List all indexes in the database:

```python
indexes = await conn.schema_reader.get_indexes()

for idx in indexes:
    print(f"{idx.name}: {idx.label}.{idx.properties} ({idx.type})")
```

Each `IndexInfo` object contains:

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Index name |
| `label` | `str` | Label the index applies to |
| `properties` | `list[str]` | Indexed property names |
| `type` | `str` | `"btree"`, `"fulltext"`, `"vector"`, or `"composite"` |

### Get Constraints

List all constraints:

```python
constraints = await conn.schema_reader.get_constraints()

for c in constraints:
    print(f"{c.name}: {c.label}.{c.properties} ({c.type})")
```

Each `ConstraintInfo` object contains:

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Constraint name |
| `label` | `str` | Label the constraint applies to |
| `properties` | `list[str]` | Constrained property names |
| `type` | `str` | `"unique"`, `"exists"`, or `"node_key"` |

---

## Create Indexes

### B-tree Index

The default index type, optimized for equality and range lookups:

```python
await conn.schema_writer.create_index(
    label="Person",
    properties=["name"],
)
```

### Named Index

Provide an explicit name for easier management:

```python
await conn.schema_writer.create_index(
    label="Person",
    properties=["name"],
    name="idx_person_name",
)
```

### Composite Index

Index multiple properties together for queries that filter on both:

```python
await conn.schema_writer.create_index(
    label="Movie",
    properties=["title", "released"],
    index_type="composite",
    name="idx_movie_title_released",
)
```

### Full-text Index

For text search queries using `CONTAINS`, `STARTS_WITH`, and `ENDS_WITH` filters:

```python
await conn.schema_writer.create_index(
    label="Person",
    properties=["name"],
    index_type="fulltext",
    name="idx_person_name_ft",
)
```

### Drop an Index

```python
await conn.schema_writer.drop_index("idx_person_name")
```

---

## Create Constraints

### Uniqueness Constraint

Ensure a property value is unique across all vertices with a given label:

```python
await conn.schema_writer.create_constraint(
    label="Person",
    properties=["email"],
    constraint_type="unique",
    name="uniq_person_email",
)
```

!!! note
    Creating a uniqueness constraint also implicitly creates an index on the constrained properties in most graph databases.

### Existence Constraint

Require that a property is always present (not null):

```python
await conn.schema_writer.create_constraint(
    label="Person",
    properties=["name"],
    constraint_type="exists",
    name="exists_person_name",
)
```

### Node Key Constraint

Combines uniqueness and existence — the properties must be present and their combination must be unique:

```python
await conn.schema_writer.create_constraint(
    label="Movie",
    properties=["title", "released"],
    constraint_type="node_key",
    name="key_movie_title_released",
)
```

### Drop a Constraint

```python
await conn.schema_writer.drop_constraint("uniq_person_email")
```

---

## Vector Indexes

Databases with vector search support expose an additional `vector` queryset for managing vector indexes and running similarity search.

!!! tip "Capability check"
    Not all databases support vector search. Check `conn.capabilities()` before using the vector queryset.

### Create a Vector Index

```python
from invana.graph.connectors import Capability

if Capability.VECTOR_SEARCH in conn.capabilities():
    await conn.vector.create_vector_index(
        label="Document",
        property_name="embedding",
        dimensions=1536,
        similarity="cosine",
        name="vec_document_embedding",
    )
```

Parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `label` | `str` | — | Node label |
| `property_name` | `str` | — | Property storing the vector |
| `dimensions` | `int` | — | Vector dimensionality |
| `similarity` | `str` | `"cosine"` | `"cosine"` or `"euclidean"` |
| `name` | `str \| None` | `None` | Optional index name |

### Similarity Search

```python
results = await conn.vector.similarity_search(
    label="Document",
    embedding=[0.1, 0.2, ...],  # query vector
    top_k=10,
    property_name="embedding",
)

for vertex in results:
    print(vertex.properties["title"])
```

### Drop a Vector Index

```python
await conn.vector.drop_vector_index("vec_document_embedding")
```

---

## Connector Capabilities

Each connector advertises the features it supports. Use this to write portable code:

```python
from invana.graph.connectors import Capability

caps = conn.capabilities()

print(Capability.TRANSACTIONS in caps)       # True/False
print(Capability.VECTOR_SEARCH in caps)      # True/False
print(Capability.FULLTEXT_INDEX in caps)      # True/False
print(Capability.SCHEMA_ENFORCEMENT in caps)  # True/False
```

| Capability | Description |
|---|---|
| `CYPHER` | Supports Cypher query language |
| `GREMLIN` | Supports Gremlin query language |
| `VECTOR_SEARCH` | Supports vector indexes and similarity search |
| `FULLTEXT_INDEX` | Supports full-text search indexes |
| `SCHEMA_ENFORCEMENT` | Enforces schema constraints at the database level |
| `TRANSACTIONS` | Supports explicit transactions |

---

## Queryset Reference

| Queryset | Access | Operations |
|---|---|---|
| **Schema Reader** | `conn.schema_reader` | `get_node_labels`, `get_edge_labels`, `get_property_keys`, `get_indexes`, `get_constraints` |
| **Schema Writer** | `conn.schema_writer` | `create_index`, `drop_index`, `create_constraint`, `drop_constraint` |
| **Vector** | `conn.vector` | `create_vector_index`, `drop_vector_index`, `similarity_search` |

## What's Next

- [Data Operations](data.md) — create, read, update, and delete vertices and edges
- [Running Queries](../running-queries.md) — execute raw Cypher or Gremlin when you need full query language power
- [Building an Ontology](../building-ontology.md) — define node types, edge types, and validation rules
