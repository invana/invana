# Data Operations

Invana provides a unified async Python API for creating, reading, updating, and deleting graph data — vertices and edges — across all supported databases. You write the same code regardless of whether the backend is Neo4j, Memgraph, JanusGraph, Neptune, or TinkerGraph.

!!! info "No query language required"
    The connector SDK handles query generation internally. You never need to write Cypher or Gremlin for standard CRUD operations.

## Prerequisites

- Invana installed (`pip install invana`)
- A connector package installed (e.g. `pip install invana-neo4j`)
- A running graph database

## Connecting

All examples in this guide assume an active connector:

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

The same code works with any connector — just swap the import and URI:

| Backend | Package | URI format |
|---|---|---|
| Neo4j | `invana-neo4j` | `bolt://host:7687` |
| Memgraph | `invana-memgraph` | `bolt://host:7687` |
| JanusGraph | `invana-janusgraph` | `ws://host:8182/gremlin` |
| Neptune | `invana-neptune` | `wss://host:8182/gremlin` |
| TinkerGraph | `invana-tinkergraph` | `ws://host:8182/gremlin` |
| ArcadeDB | `invana-arcadedb` | `ws://host:2480/gremlin` |

## Domain Example

All examples use a simple movie graph:

```
(Person) -[:ACTED_IN]-> (Movie)
(Person) -[:DIRECTED]-> (Movie)
```

---

## Create

### Create a Vertex

```python
person = await conn.data_writer.create_vertex(
    label="Person",
    properties={"name": "Keanu Reeves", "born": 1964},
)

print(person.id)          # database-assigned ID
print(person.label)       # "Person"
print(person.properties)  # {"name": "Keanu Reeves", "born": 1964}
```

The returned `Vertex` object contains:

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Database-assigned element ID |
| `label` | `str` | Node label |
| `properties` | `dict` | Key-value property map |

### Create an Edge

```python
movie = await conn.data_writer.create_vertex(
    label="Movie",
    properties={"title": "The Matrix", "released": 1999},
)

acted_in = await conn.data_writer.create_edge(
    label="ACTED_IN",
    source_id=person.id,
    target_id=movie.id,
    properties={"roles": ["Neo"]},
)

print(acted_in.id)      # database-assigned ID
print(acted_in.source)  # person.id
print(acted_in.target)  # movie.id
```

The returned `Edge` object contains:

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Database-assigned element ID |
| `label` | `str` | Relationship type |
| `source` | `str` | Source vertex ID |
| `target` | `str` | Target vertex ID |
| `properties` | `dict` | Key-value property map |

### Bulk Create

For importing large datasets, use bulk operations instead of individual creates:

```python
# Create many vertices at once
people = await conn.bulk.bulk_create_vertices(
    label="Person",
    records=[
        {"name": "Carrie-Anne Moss", "born": 1967},
        {"name": "Laurence Fishburne", "born": 1961},
        {"name": "Hugo Weaving", "born": 1960},
    ],
)

# Create many edges at once
edges = await conn.bulk.bulk_create_edges(
    label="ACTED_IN",
    records=[
        {"source_id": people[0].id, "target_id": movie.id, "properties": {"roles": ["Trinity"]}},
        {"source_id": people[1].id, "target_id": movie.id, "properties": {"roles": ["Morpheus"]}},
        {"source_id": people[2].id, "target_id": movie.id, "properties": {"roles": ["Agent Smith"]}},
    ],
)
```

!!! tip "Performance"
    Bulk operations execute in a single query round-trip, making them significantly faster than looping over individual creates.

---

## Read

### Read a Vertex by ID

```python
vertex = await conn.data_reader.read_vertex_by_id(person.id)

print(vertex.label)       # "Person"
print(vertex.properties)  # {"name": "Keanu Reeves", "born": 1964}
```

### Read an Edge by ID

```python
edge = await conn.data_reader.read_edge_by_id(acted_in.id)

print(edge.label)   # "ACTED_IN"
print(edge.source)  # person.id
print(edge.target)  # movie.id
```

### Read Vertices by Label

```python
# All Person vertices
people = await conn.data_reader.read_vertices("Person")

# With pagination
page = await conn.data_reader.read_vertices(
    "Person",
    limit=10,
    offset=20,
)
```

### Read Edges by Label

```python
# All ACTED_IN edges
edges = await conn.data_reader.read_edges("ACTED_IN")

# Filter by source/target label
edges = await conn.data_reader.read_edges(
    "ACTED_IN",
    source_label="Person",
    target_label="Movie",
    limit=50,
)
```

### Read Neighbors

Traverse the graph from a vertex:

```python
from invana.graph.connectors import GraphResponse

# All neighbors (both directions)
neighborhood: GraphResponse = await conn.data_reader.read_neighbors(person.id)

# Outgoing edges only
outgoing = await conn.data_reader.read_neighbors(
    person.id,
    direction="out",
)

# Filter by edge type
acted_movies = await conn.data_reader.read_neighbors(
    person.id,
    direction="out",
    edge_label="ACTED_IN",
    limit=10,
)

# Access the results
for node in acted_movies.nodes:
    print(node.label, node.properties)
for edge in acted_movies.edges:
    print(edge.label, edge.source, "->", edge.target)
```

The `direction` parameter controls traversal:

| Value | Meaning |
|---|---|
| `"both"` | Incoming and outgoing edges (default) |
| `"out"` | Outgoing edges only |
| `"in"` | Incoming edges only |

### Shortest Path

```python
path = await conn.data_reader.shortest_path(
    source_id=person_a.id,
    target_id=person_b.id,
    max_depth=5,
)

if path:
    print(f"Path length: {len(path.edges)}")
    for v in path.vertices:
        print(v.label, v.properties.get("name"))
```

### Count

```python
# Count all vertices with a label
total_people = await conn.data_reader.count_vertices("Person")
total_movies = await conn.data_reader.count_vertices("Movie")

# Count all edges with a label
total_acted = await conn.data_reader.count_edges("ACTED_IN")

# Count all vertices (no label filter)
total_nodes = await conn.data_reader.count_vertices()
```

### Filtering

Use `FilterExpression` and `FilterGroup` to build query predicates without writing raw queries:

```python
from invana.graph.connectors import FilterExpression, FilterGroup, FilterOp

# Simple: born after 1960
people = await conn.data_reader.read_vertices(
    "Person",
    filters=FilterGroup(conditions=[
        FilterExpression(property="born", op=FilterOp.GT, value=1960),
    ]),
)

# Combined: born after 1960 AND name starts with "K"
people = await conn.data_reader.read_vertices(
    "Person",
    filters=FilterGroup(
        operator="and",
        conditions=[
            FilterExpression(property="born", op=FilterOp.GT, value=1960),
            FilterExpression(property="name", op=FilterOp.STARTS_WITH, value="K"),
        ],
    ),
)

# OR logic
people = await conn.data_reader.read_vertices(
    "Person",
    filters=FilterGroup(
        operator="or",
        conditions=[
            FilterExpression(property="name", op=FilterOp.EQ, value="Keanu Reeves"),
            FilterExpression(property="name", op=FilterOp.EQ, value="Carrie-Anne Moss"),
        ],
    ),
)
```

#### Available Filter Operators

| Operator | Description | Example |
|---|---|---|
| `EQ` | Equal | `name == "Alice"` |
| `NEQ` | Not equal | `name != "Alice"` |
| `GT` | Greater than | `age > 30` |
| `GTE` | Greater than or equal | `age >= 30` |
| `LT` | Less than | `age < 30` |
| `LTE` | Less than or equal | `age <= 30` |
| `IN` | In list | `status in ["active", "pending"]` |
| `NOT_IN` | Not in list | `status not in ["deleted"]` |
| `CONTAINS` | String contains | `name contains "ee"` |
| `STARTS_WITH` | String prefix | `name starts with "K"` |
| `ENDS_WITH` | String suffix | `name ends with "es"` |
| `IS_NULL` | Property is null | `email is null` |
| `IS_NOT_NULL` | Property is not null | `email is not null` |

#### Nested Filter Groups

Filter groups can be nested for complex logic:

```python
# (born > 1960 AND born < 1970) OR (name = "Hugo Weaving")
filters = FilterGroup(
    operator="or",
    conditions=[
        FilterGroup(
            operator="and",
            conditions=[
                FilterExpression(property="born", op=FilterOp.GT, value=1960),
                FilterExpression(property="born", op=FilterOp.LT, value=1970),
            ],
        ),
        FilterExpression(property="name", op=FilterOp.EQ, value="Hugo Weaving"),
    ],
)

people = await conn.data_reader.read_vertices("Person", filters=filters)
```

---

## Update

### Update a Vertex

Properties are **merge-updated** — existing properties not included in the update are preserved:

```python
updated = await conn.data_writer.update_vertex(
    vertex_id=person.id,
    properties={"born": 1964, "nationality": "Canadian"},
)

# Original "name" property is preserved
print(updated.properties)
# {"name": "Keanu Reeves", "born": 1964, "nationality": "Canadian"}
```

### Update an Edge

```python
updated_edge = await conn.data_writer.update_edge(
    edge_id=acted_in.id,
    properties={"roles": ["Neo"], "billing": "lead"},
)
```

---

## Delete

### Delete a Vertex

Deleting a vertex also removes all its connected edges:

```python
await conn.data_writer.delete_vertex(vertex_id=person.id)
```

!!! warning "Cascade"
    Deleting a vertex automatically deletes **all edges** connected to it. This is consistent across all database backends.

### Delete an Edge

```python
await conn.data_writer.delete_edge(edge_id=acted_in.id)
```

### Bulk Delete

```python
# Delete multiple vertices (and their edges)
deleted_count = await conn.bulk.bulk_delete_vertices(
    vertex_ids=[v.id for v in people],
)
print(f"Deleted {deleted_count} vertices")

# Delete multiple edges
deleted_count = await conn.bulk.bulk_delete_edges(
    edge_ids=[e.id for e in edges],
)
print(f"Deleted {deleted_count} edges")
```

---

## Queryset Reference

All data operations are accessed through two querysets on the connector:

| Queryset | Access | Operations |
|---|---|---|
| **Data Writer** | `conn.data_writer` | `create_vertex`, `create_edge`, `update_vertex`, `update_edge`, `delete_vertex`, `delete_edge` |
| **Data Reader** | `conn.data_reader` | `read_vertices`, `read_edges`, `read_vertex_by_id`, `read_edge_by_id`, `read_neighbors`, `shortest_path`, `count_vertices`, `count_edges` |
| **Bulk** | `conn.bulk` | `bulk_create_vertices`, `bulk_create_edges`, `bulk_delete_vertices`, `bulk_delete_edges` |

## What's Next

- [Schema Operations](schema.md) — manage indexes, constraints, and inspect the database schema
- [Running Queries](../running-queries.md) — execute raw Cypher or Gremlin when you need full query language power
- [Building an Ontology](../building-ontology.md) — define node types, edge types, and validation rules
