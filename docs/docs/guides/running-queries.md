# Running Queries

Invana provides a unified query interface that works across all supported graph databases. Write queries in Cypher or Gremlin, and Invana handles routing, execution, and result normalization.

## Query Workspace

The Studio **Query Workspace** provides:

- **CodeMirror 6 editor** with syntax highlighting and autocompletion
- **Multi-tab support** for working with multiple queries
- **Result panels** — table view, JSON view, and graph visualization
- **Query history** with search and re-execution

## Cypher Queries

### Basic Patterns

```cypher
-- Find all nodes of a type
MATCH (p:Person) RETURN p

-- Find with conditions
MATCH (p:Person) WHERE p.age > 30 RETURN p.name, p.age

-- Traverse relationships
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name, m.title

-- Variable-length paths
MATCH path = (a:Person)-[:KNOWS*1..3]->(b:Person)
RETURN path
```

### Aggregations

```cypher
-- Count movies per actor
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name, count(m) AS movie_count
ORDER BY movie_count DESC
LIMIT 10

-- Average age by group
MATCH (p:Person)-[:WORKS_AT]->(c:Company)
RETURN c.name, avg(p.age) AS avg_age, count(p) AS employees
```

### Write Operations

```cypher
-- Create nodes
CREATE (p:Person {name: 'Alice', age: 30})
RETURN p

-- Create relationships
MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'})
CREATE (a)-[:KNOWS {since: 2020}]->(b)

-- Update properties
MATCH (p:Person {name: 'Alice'})
SET p.age = 31
RETURN p

-- Delete
MATCH (p:Person {name: 'Alice'})
DETACH DELETE p
```

## Gremlin Queries

### Basic Traversals

```groovy
// Find all Person vertices
g.V().hasLabel('Person')

// Filter by property
g.V().hasLabel('Person').has('age', gt(30)).values('name')

// Traverse edges
g.V().hasLabel('Person').out('ACTED_IN').hasLabel('Movie').values('title')

// Variable-length paths
g.V().hasLabel('Person').repeat(out('KNOWS')).times(3).path()
```

### Aggregations

```groovy
// Count by label
g.V().hasLabel('Person').out('ACTED_IN').groupCount().by('title')

// Group and aggregate
g.V().hasLabel('Person')
  .group().by(out('WORKS_AT').values('name'))
  .by(values('age').mean())
```

### Write Operations

```groovy
// Add a vertex
g.addV('Person').property('name', 'Alice').property('age', 30)

// Add an edge
g.V().has('Person', 'name', 'Alice').as('a')
 .V().has('Person', 'name', 'Bob').as('b')
 .addE('KNOWS').from('a').to('b').property('since', 2020)

// Update property
g.V().has('Person', 'name', 'Alice').property('age', 31)

// Delete
g.V().has('Person', 'name', 'Alice').drop()
```

## API Usage

### Execute a Query

```bash
curl -X POST http://localhost:8000/api/v1/queries/execute \
  -H "Content-Type: application/json" \
  -d '{
    "language": "cypher",
    "query": "MATCH (p:Person)-[:ACTED_IN]->(m:Movie) RETURN p.name, m.title",
    "parameters": {},
    "timeout": 30
  }'
```

### Response Format

All queries return a normalized `QueryResult` envelope:

```json
{
  "query_id": "q-abc123",
  "status": "completed",
  "language": "cypher",
  "duration_ms": 42,
  "result": {
    "nodes": [
      {"id": "n1", "label": "Person", "properties": {"name": "Keanu Reeves"}},
      {"id": "n2", "label": "Movie", "properties": {"title": "The Matrix"}}
    ],
    "edges": [
      {"id": "e1", "label": "ACTED_IN", "source": "n1", "target": "n2", "properties": {"role": "Neo"}}
    ],
    "rows": [
      {"p.name": "Keanu Reeves", "m.title": "The Matrix"}
    ],
    "metadata": {
      "node_count": 2,
      "edge_count": 1,
      "row_count": 1
    }
  }
}
```

### Parameterized Queries

Use parameters to prevent injection and improve query plan caching:

```bash
curl -X POST http://localhost:8000/api/v1/queries/execute \
  -H "Content-Type: application/json" \
  -d '{
    "language": "cypher",
    "query": "MATCH (p:Person) WHERE p.age > $minAge RETURN p",
    "parameters": {"minAge": 30}
  }'
```

!!! warning "Always Use Parameters"
    Never interpolate user input directly into query strings. Always use parameterized queries to prevent injection attacks.

### Streaming Results

For large result sets, use WebSocket streaming:

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/queries/stream');

ws.send(JSON.stringify({
  language: 'cypher',
  query: 'MATCH (n) RETURN n',
  batch_size: 100
}));

ws.onmessage = (event) => {
  const batch = JSON.parse(event.data);
  // batch.type: 'batch' | 'complete' | 'error'
  // batch.nodes: [...], batch.edges: [...]
};
```

## Query Optimization

### Explain Plans

View the query execution plan:

```bash
curl -X POST http://localhost:8000/api/v1/queries/explain \
  -H "Content-Type: application/json" \
  -d '{
    "language": "cypher",
    "query": "MATCH (p:Person)-[:ACTED_IN]->(m:Movie) RETURN p, m"
  }'
```

### Performance Tips

1. **Use indexes** — create indexes on frequently queried properties
2. **Limit results** — always use `LIMIT` for exploratory queries
3. **Be specific** — use labels and relationship types in patterns
4. **Use parameters** — enables query plan caching
5. **Profile slow queries** — use `EXPLAIN` to understand execution plans

## Next Steps

- [Query Engine Concepts](../concepts/query-engine.md) — understand the execution pipeline
- [Running Simulations](running-simulations.md) — use query results in simulations
- [Visualization](../studio/visualization.md) — render query results as interactive graphs
