# RFC-035: Explorer node expand — focused graph-traversal APIs

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-18
**Related**:
- **RFC-024** (Query Sessions) — established `execute_query` as the *single* execution path, run only
  through the sessions message endpoint. This RFC adds a **second, deliberate** execution surface:
  typed, read-only, individually-triggerable **traversal** endpoints that bypass the NL/QL session
  machinery. They reuse the same connector pool + `_resolve_connector` helper. The sessions/NL path may
  later call the same connector methods, but traversal does not depend on a session.
- **RFC-033** (Explorer results in thread) — results paint onto the same `ExplorerCanvas`. Expansion
  *merges* neighbours into the existing canvas rather than replacing it.
- **MVP § 5.5** (Studio Explorer) — adds "node expand / progressive disclosure" to the Explorer.
- **RFC-022** (property-type capabilities) — expansion filters/sort operate over the same property
  vocabulary the connector advertises; no new capability surface is introduced here.

---

## Problem / intent

The Explorer canvas already supports a node right-click menu, but every item operates on
*already-loaded* data (focus / select / highlight neighbourhood). There is **no way to pull a node's
neighbours from the graph database**. The reference UX (Neo4j-Browser-style "Load neighbors" / "Load
incoming relationships") is the target.

A user exploring a knowledge graph needs to walk outward from a node:

- load **all neighbours**,
- load neighbours of a specific **node type** (label), or
- load neighbours across a specific **edge type** with a **direction** (incoming / outgoing / both).

A real node can have 1000+ neighbours. Loading all of them is useless and slow. Expansion must be
**fine-tunable** so the user pulls only the meaningful slice:

- **pagination** — page size + offset, with a total so the UI can say "showing 50 of 1,240",
- **sorting** — by a neighbour property, ascending or descending,
- **filters** — property conditions on the neighbour.

The connector layer already has most primitives: a typed `FilterGroup` DSL, `limit`/`offset`
pagination, and a `read_neighbors(vertex_id, direction, edge_label, limit)` method on
`BaseDataReaderQuerySet`. What's missing is **sorting** (no `ORDER BY` / `.order()` anywhere), a
**neighbour-label** filter, **offset/filters on `read_neighbors`**, **counts**, and the fact that none
of these queryset methods are exposed over HTTP.

---

## Decisions

1. **Dedicated typed traversal APIs, not frontend query-string generation.** The frontend never builds
   Cypher/Gremlin. Three focused endpoints map to focused connector methods and return a DB-agnostic
   `GraphResponse`. This keeps query logic in the connector (one implementation per family, reused by
   Neo4j/Memgraph/Gremlin vendors) and keeps the read read-only by construction.

2. **Several focused endpoints**, each with its own connector method:

   | Endpoint (POST, under `/api/v1/u/{username}/{graphSlug}/explorer`) | Connector method |
   | --- | --- |
   | `/expand/neighbors`     | `data_reader.read_neighbors` / `count_neighbors` |
   | `/expand/by-edge-type`  | `data_reader.read_neighbors_by_edge_type` / `count_neighbors_by_edge_type` |
   | `/expand/by-node-type`  | `data_reader.read_neighbors_by_node_type` / `count_neighbors_by_node_type` |

   The three public connector methods each delegate to a single shared parameterized builder call
   (`match_neighbors` with optional `edge_label` / `neighbor_label`), so the explicit/readable surface
   has **no duplicated query logic** underneath.

3. **Counts are included.** Each expand response carries `total`, `offset`, `limit`, `returned`,
   `has_more`. `count_neighbors*` runs the same MATCH/WHERE without sort/pagination. `has_more` is
   `offset + returned < total`.

4. **Filters/sort/pagination apply to the neighbour** (`m`), not the edge — so "load the 50 most-recent
   `ACTED_IN` neighbours named like 'Tom'" is expressible.

---

## Connector surface

### New type — `SortSpec` (`invana/graph/types/sort.py`)
```python
class SortDirection(StrEnum):  # "asc" | "desc"
class SortSpec(BaseModel):     # { property: str, direction: SortDirection = asc }
```

### Query builders
- **Cypher** (`OpenCypherQueryBuilder`): `match_neighbors` widened to
  `(vertex_id, direction, edge_label, neighbor_label, filters, sort, limit, offset)`. Neighbour label
  injected as `(m:`Label`)`; WHERE = `elementId(n) = $vid` AND the filter clause built on `m`; new
  `_order_clause(sort, "m")` between `RETURN n, r, m` and `SKIP`/`LIMIT`. New
  `count_neighbors(...)` → `RETURN count(m) AS cnt`.
- **Gremlin** (`GremlinQueryBuilder`): `match_neighbors` restructured to step **to the neighbour**
  (`.both_e(...).as_("e").other_v().as_("m")`) so `has_label` / filters / `.order().by()` apply to `m`,
  then `.select("e")` + `_project_edge(t)` preserves the existing projection shape. New
  `_apply_order(t, sort)` (`Order.asc/desc`) and `count_neighbors(...)` → `.count()`.

### Querysets
`BaseDataReaderQuerySet` gains the six abstract methods (`read_neighbors` widened; `*_by_edge_type`,
`*_by_node_type`; `count_neighbors`, `count_neighbors_by_edge_type`, `count_neighbors_by_node_type`).
`OpenCypherDataReaderQuerySet` + `GremlinDataReaderQuerySet` implement them by forwarding to the shared
builder calls. `invana-neo4j` inherits unchanged (it only overrides schema/algorithms querysets).

---

## API contract

Request (shared base; `by-edge-type` adds `edge_label`, `by-node-type` adds `neighbor_label`):
```jsonc
{ "vertex_id": "4:abc:1", "direction": "out",
  "filters": { "operator": "and", "conditions": [ ... ] },   // optional FilterGroup
  "sort": [ { "property": "name", "direction": "asc" } ],     // optional
  "limit": 50, "offset": 0, "timeout_ms": 10000 }
```
Response:
```jsonc
{ "data": { "nodes": [...], "edges": [...], "records": [], "metadata": {...} },
  "total": 1240, "offset": 0, "limit": 50, "returned": 50, "has_more": true }
```

Routes gate on `require_graph_member` + `require_graph_setup_complete` (mirrors
`sessions.send_message`). The service emits a `graph.expand` audit event (mirrors `query.execute`); no
new SQLAlchemy model → no starlette-admin view.

---

## Studio

- Schema-driven `Expand ▶` group in the node context menu (`ExplorerCanvas.nodeItems`): "Load all
  neighbors", "By node type ▶", "Incoming/Outgoing relationships ▶" (from the active `GraphVersion`'s
  node/edge types), and "Fine-tune expand…".
- `ExpandFineTunePanel` (`@invana/design-kit`) for direction / edge-type / node-type / page size / sort /
  filters, with "Load next page" + "Showing X of N".
- Results **merge** (dedupe by id) into `ExplorerPage`'s `canvasData`; the existing data-ref-driven
  d3-force relayout repaints. Per-node pagination state keyed by
  `vertex_id:direction:edge_label:neighbor_label`.

---

## Out of scope

- Multi-hop expansion (depth > 1) — single hop only in this RFC.
- Persisting expansion state across reloads — ephemeral, like the rest of the Explorer canvas.
- Collapse/un-expand (the `@invana/canvas-react` `CollapseExpandBehaviour` exists but is a follow-up).
