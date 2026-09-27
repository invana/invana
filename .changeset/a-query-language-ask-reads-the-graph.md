---
"invana": patch
---

A query-language ask reads the graph again, and never drafts a model (WQ5 · AG3).

The Graph's default agent could be set to the Modeller, and every new Explorer session then bound
it: a typed Cypher query ran *Understand → Propose → Validate*, drafted a model named after the
query, and failed at the end. Now the default must be an agent whose envelope allows
`execute_graph_query` — making the Modeller the default is a 409 — and a stored default that cannot
answer is passed over for the seeded Explorer. An Explorer session already bound to such an agent
is refused with a 422 that names it, rather than being run or silently re-routed.
