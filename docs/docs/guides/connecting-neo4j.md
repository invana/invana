# Connecting to Neo4j

This guide walks through connecting Invana to a Neo4j database, creating an ontology, and running your first queries.

## Prerequisites

- Neo4j 5.x running locally or remotely
- Invana installed (`pip install invana`)

## Start Neo4j

=== "Docker"

    ```bash
    docker run -d \
      --name neo4j \
      -p 7474:7474 -p 7687:7687 \
      -e NEO4J_AUTH=neo4j/password \
      neo4j:5
    ```

=== "Neo4j Desktop"

    Download [Neo4j Desktop](https://neo4j.com/download/) and create a new local database.

## Configure the Connection

Set the connection details via environment variables:

```bash
export INVANA_GRAPH_BACKEND=neo4j
export INVANA_GRAPH_HOST=localhost
export INVANA_GRAPH_PORT=7687
export INVANA_GRAPH_USERNAME=neo4j
export INVANA_GRAPH_PASSWORD=password
```

Or configure in `.env`:

```ini
INVANA_GRAPH_BACKEND=neo4j
INVANA_GRAPH_HOST=localhost
INVANA_GRAPH_PORT=7687
INVANA_GRAPH_USERNAME=neo4j
INVANA_GRAPH_PASSWORD=password
```

## Start Invana

```bash
invana start
```

Open [http://localhost:8000](http://localhost:8000) to access Studio.

## Verify the Connection

Navigate to **Connections** in Studio. Your Neo4j instance should appear with a green status indicator.

You can also verify via the API:

```bash
curl http://localhost:8000/api/v1/health
```

```json
{
  "status": "healthy",
  "graph_backend": "neo4j",
  "graph_connected": true,
  "version": "2025.1.0"
}
```

## Create Your First Ontology

In Studio, navigate to **Modelling** and create a simple ontology:

### Define Node Types

| Label    | Properties                          |
|----------|-------------------------------------|
| `Person` | `name: string`, `age: integer`      |
| `Movie`  | `title: string`, `year: integer`    |

### Define Edge Types

| Label      | Source   | Target  | Properties            |
|------------|----------|---------|-----------------------|
| `ACTED_IN` | `Person` | `Movie` | `role: string`        |
| `DIRECTED` | `Person` | `Movie` | —                     |

## Run a Query

Switch to the **Query Workspace** and execute:

```cypher
// Create some data
CREATE (keanu:Person {name: 'Keanu Reeves', age: 60})
CREATE (matrix:Movie {title: 'The Matrix', year: 1999})
CREATE (keanu)-[:ACTED_IN {role: 'Neo'}]->(matrix)
RETURN keanu, matrix
```

The results render automatically in the graph canvas.

## Query with Filters

```cypher
MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)
WHERE m.year > 1990
RETURN p.name, r.role, m.title
```

## Connection Pooling

For production workloads, tune the connection pool:

```bash
INVANA_GRAPH_POOL_SIZE=20
INVANA_GRAPH_POOL_MAX_OVERFLOW=10
INVANA_GRAPH_POOL_TIMEOUT=30
```

## Encryption

Enable bolt+s for encrypted connections:

```bash
INVANA_GRAPH_HOST=neo4j+s://your-instance.neo4j.io
```

## Next Steps

- [Building an Ontology](building-ontology.md) — design a complete domain model
- [Running Queries](running-queries.md) — advanced query patterns
- [Visualization](../studio/visualization.md) — customize graph rendering
