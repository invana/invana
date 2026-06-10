---
"invana": patch
"studio": patch
---

Block queries/modelling until graph setup is complete, with a clear message.

The engine's `require_graph_setup_complete` guard now returns a human-readable `message` alongside the existing `graph_setup_incomplete` / `missing_sections` 409 detail, so the failure explains itself instead of surfacing a bare conflict.

Studio mirrors the guard client-side: Explorer and Modeller now show a "Finish the setup wizard (Graph Info + Intent)" empty-state — and Explorer refuses to fire a query — whenever the required setup sections aren't complete, instead of letting the request bounce off the engine with a 409.
