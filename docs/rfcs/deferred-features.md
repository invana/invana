# Deferred Features

A running list of features that were explicitly considered and intentionally deferred from current RFCs. Each entry records which RFC deferred it, a brief reason, and a suggested future RFC or tracking note.

---

## From RFC-001 — Graph Connectors

| Feature | Reason deferred | Suggested RFC |
|---|---|---|
| **Algorithm fallback engine** — Python-based graph algorithms (NetworkX / igraph) as fallback when the connected DB has no native algorithm support | Adds significant dependency surface; most target DBs (Neo4j, Memgraph) have native algo support. Not blocking for v1. | RFC-00X: Graph Algorithm Engine |

---

## From RFC-002 — Graph Modeller

| Feature | Reason deferred | Suggested RFC |
|---|---|---|
| **Namespaces & URIs** — Globally unique identifiers for types and properties (e.g., `schema:Person`, `foaf:knows`) | Semantic web interoperability is a separate concern from structural schema enforcement. Not needed for graph-DB-native use cases. | RFC-003: Ontology & Semantics Layer |
| **Annotations** — Multi-language labels and descriptions (BCP-47 language tags) | Requires namespace support as prerequisite. | RFC-003: Ontology & Semantics Layer |
| **Relationship semantics** — `inverse_of`, `is_transitive`, `is_symmetric` on edge types | Informational metadata, not enforced by graph DBs. Belongs with the semantics layer. | RFC-003: Ontology & Semantics Layer |
| **OWL / SHACL / JSON-LD export & import** — Standards-based schema interoperability (`rdflib`, `pyshacl`) | Significant complexity; adds heavy dependencies. Only relevant when integrating with semantic web tooling. | RFC-003: Ontology & Semantics Layer |
| **Reasoning / inference** — Runtime materialisation of inferred edges and properties based on semantic declarations | Requires semantics layer + reasoning engine. Out of scope for the graph modeller. | RFC-003: Ontology & Semantics Layer |
| **Graph data migrations** — Automated or assisted migration of existing graph data when a schema version introduces breaking changes (backfill missing properties, rename properties, coerce types, handle removed node/edge types) | Schema versioning and projection come first; data migration builds on both. Complex enough to warrant its own RFC. | RFC-00X: Graph Data Migrations |

---

## Notes

- Items in this file are not abandoned — they are tracked here so nothing is forgotten when planning upcoming RFCs.
- When a deferred feature is picked up in a new RFC, update its row with a link to that RFC and mark it resolved.
- Add new entries here whenever a feature is explicitly deferred from an RFC during design review.
