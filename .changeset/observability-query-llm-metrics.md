---
"invana": minor
---

Performance metrics for queries, messages, and LLM calls (RFC-041).

Every LLM provider call, every graph query, and every session message now emits an
OpenTelemetry metric — not just a trace span — so latency and throughput are answerable
in aggregate. New `invana.llm.*` instruments record provider-call duration (p50/p95/p99)
and input/output token throughput, labelled by `provider`, `model_id`, and `operation`
(translate/propose). A unified `invana.query.graph.*` family times graph queries across
**both** Cypher and Gremlin — closing a gap where Gremlin traversals (`execute_traversal`)
previously bypassed all instrumentation, so they were invisible in traces and metrics; they
now carry the same `graph.query.db_execute` span as the Cypher path. And a new
`session.message` parent span plus `invana.session.message.*` metrics capture end-to-end
message latency, labelled by `mode` (nl/ql), `surface` (explorer/modeller), and `status`.
All emit only when the optional `telemetry` extra is installed; engine core still imports
without it.
