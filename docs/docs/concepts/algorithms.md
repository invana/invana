# Graph Algorithms

Invana includes a library of graph algorithms that can be executed on your connected graph data. Algorithms run server-side and return results that can be visualized in Studio.

## Available Algorithms

### Centrality

Identify the most important nodes in a graph.

| Algorithm | Description | Use case |
|---|---|---|
| **PageRank** | Importance based on incoming links | Find influential nodes |
| **Betweenness Centrality** | Nodes that bridge communities | Find bottlenecks |
| **Closeness Centrality** | How close a node is to all others | Find well-connected nodes |
| **Eigenvector Centrality** | Importance of neighbors matters | Find nodes connected to important nodes |
| **Degree Centrality** | Count of connections | Find hubs |

### Community Detection

Find clusters and groups within the graph.

| Algorithm | Description | Use case |
|---|---|---|
| **Louvain** | Modularity-based community detection | Find natural clusters |
| **Label Propagation** | Fast community assignment | Large-scale clustering |
| **Connected Components** | Find disconnected subgraphs | Identify isolated clusters |
| **Strongly Connected Components** | Directed graph components | Dependency analysis |

### Pathfinding

Find routes and distances between nodes.

| Algorithm | Description | Use case |
|---|---|---|
| **Dijkstra** | Shortest weighted path | Find optimal routes |
| **A*** | Heuristic shortest path | Goal-directed search |
| **All Shortest Paths** | All shortest paths between two nodes | Find alternatives |
| **Breadth-First Search** | Unweighted shortest path | Find nearest matches |

### Similarity

Measure how similar nodes are to each other.

| Algorithm | Description | Use case |
|---|---|---|
| **Jaccard Similarity** | Overlap of neighborhoods | Find similar entities |
| **Cosine Similarity** | Vector-based similarity | Embedding comparison |
| **Node2Vec** | Learn node embeddings | ML feature generation |

## Running an Algorithm

### Via API

```bash
curl -X POST http://localhost:8000/api/v1/algorithms/execute \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "conn_abc",
    "algorithm": "pagerank",
    "parameters": {
      "node_type": "Person",
      "edge_type": "KNOWS",
      "damping_factor": 0.85,
      "max_iterations": 20,
      "tolerance": 1e-6
    }
  }'
```

### Response

```json
{
  "algorithm": "pagerank",
  "duration_ms": 340,
  "result": {
    "scores": [
      {"node_id": "n1", "label": "Person", "name": "Alice", "score": 0.42},
      {"node_id": "n2", "label": "Person", "name": "Bob", "score": 0.31},
      {"node_id": "n3", "label": "Person", "name": "Charlie", "score": 0.27}
    ],
    "metadata": {
      "iterations": 12,
      "converged": true,
      "nodes_processed": 1500
    }
  }
}
```

### Via Studio

1. Open the **Algorithms** panel
2. Select an algorithm
3. Configure parameters (node types, edge types, thresholds)
4. Run — results appear in the table and can be overlaid on the graph visualization (node size = score)

## Combining with Simulations

Algorithms can be used as inputs to simulations. For example:

1. Run **community detection** to identify player groups
2. Feed communities into a **game theory simulation** as competing agents
3. Analyze outcomes across parameter sweeps

See [Simulations](simulations.md) for details.

## What's Next?

- [Simulations](simulations.md) — Run algorithms in tandem with decision models
- [Running Queries](../guides/running-queries.md) — Execute raw queries
