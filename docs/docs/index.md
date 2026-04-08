---
hide:
  - navigation
  - toc
---

# Invana

## Graph Intelligence Platform

**Structured knowledge graphs into interactive decision simulation environments.**

Invana is an open-source platform that combines graph modelling, high-performance query execution, visual exploration, and decision simulation into a single tool. Connect to your graph database, model your domain ontology, query and visualize your data, and run simulations — all from one place.

<div class="grid cards" markdown>

-   :material-graph-outline:{ .lg .middle } **Graph Modelling**

    ---

    Define ontologies with node types, edge types, properties, and constraints. Version your schema and evolve it over time.

    [:octicons-arrow-right-24: Learn more](concepts/ontology-modelling.md)

-   :material-database-search:{ .lg .middle } **Query Engine**

    ---

    Execute Cypher or Gremlin queries across Neo4j, Memgraph, JanusGraph, Neptune, and more — with one unified interface.

    [:octicons-arrow-right-24: Learn more](concepts/query-engine.md)

-   :material-chart-scatter-plot:{ .lg .middle } **Visualization**

    ---

    Explore graphs interactively with a high-performance WebGPU/WebGL renderer powered by PixiJS 8. Handles 100K+ nodes at 60fps.

    [:octicons-arrow-right-24: Learn more](studio/visualization.md)

-   :material-dice-multiple:{ .lg .middle } **Simulations**

    ---

    Run decision simulations with game theory, hypothesis testing, and parameter sweeps on your graph models.

    [:octicons-arrow-right-24: Learn more](concepts/simulations.md)

</div>

## Quick Start

```bash
pip install invana
invana start
```

Open [http://localhost:8000](http://localhost:8000) to access Invana Studio.

[:octicons-arrow-right-24: Full installation guide](getting-started/installation.md)

## Supported Graph Databases

| Language | Databases |
|---|---|
| **Cypher** | Neo4j, Memgraph, ArcadeDB |
| **Gremlin** | JanusGraph, Amazon Neptune, TinkerGraph, ArcadeDB |
| **Vector** | Any of the above with vector index support |

## Why Invana?

- **Database-agnostic** — One tool for all your graph databases, regardless of query language
- **Model-first** — Define your domain ontology before querying. Schema versioning built in.
- **High-performance** — Async query engine with connection pooling. WebGPU-powered visualization.
- **Simulation-ready** — Go beyond querying. Test hypotheses, run game theory models, explore decision trees.
- **Open source** — Apache 2.0 licensed. Self-host anywhere.
