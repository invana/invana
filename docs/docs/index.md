---
hide:
  - navigation
  - toc
---

# Invana

**An ontology-governed decision intelligence platform for humans and AI agents.**

One knowledge graph, one set of rules, for every thinker and the systems they build.

Invana is open source. People and agents work on the same knowledge graph, and the ontology governs both: agents do the work, the person decides, with evidence anyone can follow.

Invana offers three pillars — **Ontology** (Model · Data · Datasets), **Agents** and **Evidence** (Explore ·
Projects) — on one operating system.

<div class="grid cards" markdown>

-   :material-graph-outline:{ .lg .middle } **Model**

    ---

    Give the data meaning: models with node types, edge types, properties and constraints, links between models and the rules that must always hold. Every model is versioned and published.

    [:octicons-arrow-right-24: Learn more](concepts/ontology-modelling.md)

-   :material-database-search:{ .lg .middle } **Explore**

    ---

    Ask in plain words, or write Cypher or Gremlin across Neo4j, Memgraph, JanusGraph, Neptune and more, and see the answer drawn on a canvas — WebGPU/WebGL, 100K+ nodes at 60fps — traced to its records.

    [:octicons-arrow-right-24: Learn more](concepts/query-engine.md)

-   :material-robot-outline:{ .lg .middle } **Agents**

    ---

    Build agents and skills that work the data into insight and do the work, only as far as people allow.

-   :material-dice-multiple:{ .lg .middle } **Projects**

    ---

    Pursue a question on branches with findings for and against. Run a simulator on a branch over pinned dataset versions, reproducible from its seed, and cite the result in a finding.

    [:octicons-arrow-right-24: Learn more](concepts/simulations.md)

</div>

All of it runs on the operating system: **Graph** — where you work · **Access** — who may act, and what they did ·
**Runtime** — what does the work, within which limits.
[:octicons-arrow-right-24: Architecture](concepts/architecture.md)

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
