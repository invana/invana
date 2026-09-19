---
"invana": patch
---

The browser-span proxy is always there (docs/for-developers/modules/platform/features/telemetry.md TE6).

`POST /api/v1/telemetry/traces` used to be mounted only when the engine's telemetry was on, while the studio exports on its own gate — so an engine started with `INVANA_TELEMETRY_ENABLED=false` answered every span batch with a 404, and the browser console filled with `export response failure (status: 404)` for the life of the page. The route is now always mounted; with telemetry off it accepts the batch and drops it (202). Nothing is forwarded and nothing is logged as an error, which is what "telemetry is optional" was supposed to mean on both ends.
