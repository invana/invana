---
"invana": patch
"studio": patch
---

A run and every event now open the trace they were written in.

- Each run stores its trace id and the id of its run span, and every event stores its trace and span ids,
  filled automatically. Nothing needs to pass them in.
- A run's drawer (*The run*) and an event's details show a `trace` row. It links to the collector's trace
  view when `VITE_TELEMETRY_TRACE_URL` is set; otherwise it shows the id as plain text.
