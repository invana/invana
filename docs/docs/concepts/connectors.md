# Connectors

Connectors are database adapters that translate between Invana's unified interface and specific graph database drivers. They follow a plugin-style architecture.

## Supported Connectors

### Cypher Backends

| Database | Connector | Driver | Vector Support |
|---|---|---|---|
| **Neo4j** | `neo4j` | `neo4j` (async) | :material-check: (v5+) |
| **Memgraph** | `memgraph` | `neo4j` (Bolt compatible) | :material-close: |
| **ArcadeDB** | `arcadedb-cypher` | HTTP API | :material-close: |

### Gremlin Backends

| Database | Connector | Driver | Vector Support |
|---|---|---|---|
| **JanusGraph** | `janusgraph` | `gremlinpython` | :material-close: |
| **Amazon Neptune** | `neptune` | `gremlinpython` + SigV4 | :material-check: |
| **TinkerGraph** | `tinkergraph` | `gremlinpython` | :material-close: |
| **ArcadeDB** | `arcadedb-gremlin` | `gremlinpython` | :material-close: |

## Connector Protocol

Every connector implements a standard protocol:

```python
class ConnectorProtocol:
    async def connect() -> None
    async def disconnect() -> None
    async def execute(query: str, parameters: dict) -> RawResult
    async def health_check() -> bool
    def capabilities() -> set[Capability]
```

### Capabilities

Connectors declare what features they support:

| Capability | Description | Connectors |
|---|---|---|
| `CYPHER` | Cypher query execution | neo4j, memgraph, arcadedb-cypher |
| `GREMLIN` | Gremlin query execution | janusgraph, neptune, tinkergraph, arcadedb-gremlin |
| `VECTOR_SEARCH` | Vector similarity queries | neo4j (v5+), neptune |
| `FULLTEXT_INDEX` | Full-text search | neo4j, memgraph |
| `SCHEMA_ENFORCEMENT` | DB-level schema constraints | neo4j, memgraph |
| `TRANSACTIONS` | Multi-query transactions | neo4j, memgraph, neptune |

## Connection Configuration

Each connector type has specific connection parameters:

=== "Neo4j"

    ```json
    {
      "type": "neo4j",
      "uri": "bolt://localhost:7687",
      "credentials": {
        "username": "neo4j",
        "password": "password"
      },
      "database": "neo4j",
      "pool_size": 10
    }
    ```

=== "Neptune"

    ```json
    {
      "type": "neptune",
      "uri": "wss://your-cluster.neptune.amazonaws.com:8182/gremlin",
      "credentials": {
        "aws_region": "us-east-1",
        "aws_access_key_id": "...",
        "aws_secret_access_key": "..."
      }
    }
    ```

=== "JanusGraph"

    ```json
    {
      "type": "janusgraph",
      "uri": "ws://localhost:8182/gremlin",
      "pool_size": 10
    }
    ```

## Connector Registry

Connectors are auto-discovered and registered at startup. To check available connectors:

```bash
curl http://localhost:8000/api/v1/connectors
```

```json
{
  "connectors": [
    {
      "type": "neo4j",
      "language": "cypher",
      "capabilities": ["CYPHER", "VECTOR_SEARCH", "FULLTEXT_INDEX", "SCHEMA_ENFORCEMENT", "TRANSACTIONS"]
    },
    {
      "type": "tinkergraph",
      "language": "gremlin",
      "capabilities": ["GREMLIN"]
    }
  ]
}
```

## Vector Search

For databases that support vector indexes, Invana provides a unified vector search interface:

```bash
curl -X POST http://localhost:8000/api/v1/queries/vector-search \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "conn_abc",
    "node_type": "Document",
    "property": "embedding",
    "vector": [0.1, 0.2, 0.3, ...],
    "top_k": 10,
    "similarity": "cosine"
  }'
```

This is translated to the native vector search syntax of the connected database.

## What's Next?

- [Connecting to Neo4j](../guides/connecting-neo4j.md) — Step-by-step setup
- [Query Engine](query-engine.md) — How queries are executed
