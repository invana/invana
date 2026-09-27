---
"invana": minor
"studio": patch
---

Logs record what happened and to whom, and Studio sends its errors.

- Every log line carries `principal`, `origin` and `graph_id` when they are known, alongside
  `trace_id` and `span_id`: inline in the console format, as fields in JSON and OTLP.
- A run logs when it starts, finishes, is paused for a person, is cancelled or fails (with its
  failure kind). Startup logs when it has finished, and a Graph connection logs when it goes down
  and when it comes back.
- A 5xx is logged once, at error, with its route and trace. Every other request is now logged at
  debug instead of info.
- Credential-named fields (`password`, `api_key`, `secret`, `token`, `*_hash`, `*_encrypted`) are
  removed from every log record, by the same rule as audit events.
- Studio sends uncaught errors, unhandled rejections, route errors and failed queries (network
  errors and 5xx) as error logs through the new `POST /api/v1/telemetry/logs`, and counts them on
  `ui.errors`.
