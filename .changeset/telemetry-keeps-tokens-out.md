---
"invana": patch
---

Telemetry no longer records access tokens, and every log line names its trace.

- The `?token=` a stream URL carries is stripped from request spans and from the access log.
- The browser-span proxy is no longer traced itself.
- Console and JSON logs carry `trace_id` and `span_id` inside a span.
- Sampling is parent-based on one ratio — `INVANA_TELEMETRY_SAMPLE_RATIO` for the engine,
  `VITE_TELEMETRY_SAMPLE_RATIO` for Studio, default 1.0 — recorded on the resource.
- The compose stack points the engine at the bundled HyperDX collector.
