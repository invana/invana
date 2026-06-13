---
"invana": patch
"studio": minor
---

Session/message tracing + FE→BE stitching fix (RFC-026).

Every way of running a query in the Explorer is now traced as one distributed
trace, not just a fresh **Run**: clicking a stored message (`rerun`) and opening
a session (`restore`) each open an `explorer.query.run` root, tagged with an
`explorer.trigger` attribute (`run` | `rerun` | `restore`) so the three entry
points are distinguishable in HyperDX. Standalone session/message API ops
(list/create/pin/archive/delete) now emit their own one-span distributed trace
even outside a run — the API client traces any `…/sessions…` request and injects
`traceparent`.

Fixes two latent bugs in the RFC-025 telemetry that meant frontend and backend
traces never actually joined:

- **Engine:** `TelemetryMiddleware` now extracts the incoming W3C context and
  emits a `SERVER` span, so each request nests under the caller's span (the
  studio's browser span) as one trace. Previously it created `INTERNAL` root
  spans that ignored `traceparent` — and `FastAPIInstrumentor`, called from the
  lifespan after the middleware stack was built, was a silent no-op, so nothing
  extracted the header.
- **Studio:** the Explorer interaction lifecycle is now deterministic — one root
  per trigger, and a new trigger ends any still-open interaction first, so
  consecutive runs no longer collapse into a single trace.

No new settings. Gated by the existing `VITE_TELEMETRY_ENABLED` /
`INVANA_TELEMETRY_ENABLED` switches.
