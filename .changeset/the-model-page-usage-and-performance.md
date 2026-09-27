---
"invana": patch
---

The model page's **Usage** and **Performance** tabs read Invana's own **query log** (1.8 · MP12 ·
MP15). Every graph query someone asked is logged after it answers — never slowing or failing it —
with who asked (agent · plan · Explorer · API, read off the run), its shape (the query with its
literals taken out), its timing and what it touched (MP35 – MP38). Rows are pruned past 90 days.

- **Usage** counts queries per model or type, split by caller, with the last time each was touched,
  the stitches queries crossed and — at one model — how each property was filtered, returned or
  ordered on. Fixed rules call a type *unused*, *empty*, *hot*, *hot and slow* or a *supernode*;
  below 50 queries on the Graph it says so and calls nothing (MP10).
- **Performance** groups queries by shape with p50 · p95 · rows · callers and draws p95 a day
  against the Graph's. Picking a shape opens its card: the full shape, the plan it was explained
  with, its slowest calls (each opening its run), and — where a label is scanned and filtered on a
  property with no index — **Add index to draft** on the model that declares the label. Advice is a
  draft change; publishing projects it (MP13 · MP39).
- The **Overview** gains queries a day, p95, each row's share of queries, p95 and signals, **Needs
  attention**, and queries a day by caller.

Neo4j and Memgraph explain queries (`EXPLAIN`, never `PROFILE`). New table `graph_query_log`
(migration 058). New read: `GET /api/v1/u/{username}/{graphSlug}/models/insights/shapes/{hash}`;
`…/models/insights` now also answers `overview`, `usage` and `performance`.
