---
"invana": minor
"studio": minor
---

End-to-end query→render tracing for the Explorer (RFC-025).

Running a query in the Explorer now produces a **single distributed trace**
spanning frontend → backend → frontend, viewable as one waterfall in HyperDX.
Studio gains an OpenTelemetry-Web SDK that emits custom spans for each stage of
the pipeline: `explorer.query.run` (root) → HTTP request → `explorer.transform`
(dedupe) → `explorer.adapt` (canvas shape) → `explorer.layout` (force settle) →
`explorer.render` (first painted frame). The message-API call carries a W3C
`traceparent` — injected explicitly in the API client from the active run's
context — so the engine's spans nest underneath. (Explicit injection rather than
auto-XHR instrumentation, because the request crosses TanStack Query's async
hops and no web context manager carries the active context across Vite's native
async/await.)

The engine adds two query child spans — `graph.query.db_execute` (raw driver
round-trip) and `graph.query.serialize` (deserialization, with node/edge counts)
— so the trace separates DB time from serializer time for both Cypher and
Gremlin. Browser spans ship to the collector through a new engine proxy route
`POST /api/v1/telemetry/traces` (browsers can't speak OTLP gRPC, and this keeps
the collector off the network).

Gated by `VITE_TELEMETRY_ENABLED` (studio) and `INVANA_TELEMETRY_ENABLED`
(engine); both default on. New setting `INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT`
(default `http://localhost:4318/v1/traces`) points the proxy at the collector.
