# Quickstart

This guide walks you through connecting to a graph database, creating an ontology, and running your first query — all in under 5 minutes.

## 1. Start Invana

```bash
pip install invana
invana start
```

Open [http://localhost:8000](http://localhost:8000) in your browser to access Studio.

## 2. Connect to a Graph Database

=== "Neo4j"

    ```bash
    # Start Neo4j (if you don't have one running)
    docker run -d --name neo4j \
      -p 7474:7474 -p 7687:7687 \
      -e NEO4J_AUTH=neo4j/password \
      neo4j:5-community
    ```

    In Studio, go to **Connections** → **New Connection**:

    | Field | Value |
    |---|---|
    | Name | My Neo4j |
    | Type | Neo4j |
    | URI | `bolt://localhost:7687` |
    | Username | `neo4j` |
    | Password | `password` |

=== "Memgraph"

    ```bash
    docker run -d --name memgraph \
      -p 7687:7687 \
      memgraph/memgraph:latest
    ```

    | Field | Value |
    |---|---|
    | Name | My Memgraph |
    | Type | Memgraph |
    | URI | `bolt://localhost:7687` |

=== "TinkerGraph"

    ```bash
    docker run -d --name tinkergraph \
      -p 8182:8182 \
      tinkerpop/gremlin-server:latest
    ```

    | Field | Value |
    |---|---|
    | Name | My TinkerGraph |
    | Type | TinkerGraph |
    | URI | `ws://localhost:8182/gremlin` |

Or via the API:

```bash
curl -X POST http://localhost:8000/api/v1/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Neo4j",
    "type": "neo4j",
    "uri": "bolt://localhost:7687",
    "credentials": {
      "username": "neo4j",
      "password": "password"
    }
  }'
```

## 3. Create an Ontology

An ontology defines the types of nodes and edges in your graph — the schema for your domain.

In Studio, go to **Modelling** → **New Ontology**:

```yaml
Name: Movie Graph
Version: 1.0.0

Node Types:
  - Person:
      properties:
        - name: string (required)
        - born: integer
  - Movie:
      properties:
        - title: string (required)
        - released: integer
        - tagline: string

Edge Types:
  - ACTED_IN:
      source: Person
      target: Movie
      properties:
        - roles: list[string]
  - DIRECTED:
      source: Person
      target: Movie
```

Or via the API:

```bash
curl -X POST http://localhost:8000/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Movie Graph",
    "version": "1.0.0",
    "node_types": [
      {
        "name": "Person",
        "properties": [
          {"name": "name", "type": "string", "required": true},
          {"name": "born", "type": "integer"}
        ]
      },
      {
        "name": "Movie",
        "properties": [
          {"name": "title", "type": "string", "required": true},
          {"name": "released", "type": "integer"},
          {"name": "tagline", "type": "string"}
        ]
      }
    ],
    "edge_types": [
      {
        "name": "ACTED_IN",
        "source": "Person",
        "target": "Movie",
        "properties": [
          {"name": "roles", "type": "list[string]"}
        ]
      },
      {
        "name": "DIRECTED",
        "source": "Person",
        "target": "Movie"
      }
    ]
  }'
```

## 4. Run a Query

Go to **Query Workspace**, select your connection, and run:

=== "Cypher (Neo4j / Memgraph)"

    ```cypher
    MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)
    WHERE m.released > 1999
    RETURN p.name, m.title, r.roles
    LIMIT 25
    ```

=== "Gremlin (JanusGraph / Neptune / TinkerGraph)"

    ```groovy
    g.V().hasLabel('Person')
      .outE('ACTED_IN')
      .inV().hasLabel('Movie')
      .has('released', gt(1999))
      .path()
      .limit(25)
    ```

Results appear as both a **table** and an interactive **graph visualization**.

## 5. Visualize

Click the **Graph** tab in the query results to see nodes and edges rendered in the canvas. You can:

- **Pan and zoom** to navigate
- **Click a node** to see its properties
- **Drag nodes** to rearrange the layout
- **Switch layouts** — force-directed, hierarchical, radial

## What's Next?

- [Configuration](configuration.md) — Customize Invana settings
- [Building an Ontology](../guides/building-ontology.md) — Deep dive into modelling
- [Running Simulations](../guides/running-simulations.md) — Game theory and hypothesis testing
