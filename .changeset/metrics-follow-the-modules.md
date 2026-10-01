---
"invana": minor
"studio": patch
---

Metrics are named after the modules, and Studio now sends its own.

- Engine metrics are `invana.<module>.*`: runs, steps, LLM calls (tokens and cost), graph queries,
  streams, events, background loops and a gauge for the graph connection pool. HTTP metrics follow the
  OpenTelemetry names (`http.server.request.duration`). Durations are in seconds and attributes are
  bounded. Histogram points link to a sampled trace.
- The old `invana.api.*`, `invana.llm.*`, `invana.query.*` and `invana.session.*` metrics are gone.
  Dashboards built on them need the new names.
- `INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT` is now the collector's base URL (for example
  `http://hyperdx:4318`); a value ending in `/v1/traces` still works.
- Studio records action and request durations, Web Vitals and stream reconnects, sent through
  `/api/v1/telemetry/metrics`.
