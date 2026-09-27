---
"invana": patch
"studio": patch
---

Work nobody clicked is traced too, and a trace link opens on the right time.

- Startup, graph health sweeps, reconnect attempts, the events listener and the graph-query log each
  start their own trace. A logged query links back to the request or run that asked it.
- Every `invana` CLI command except `start` is one trace, `cli.<command>`, flushed before the
  command exits.
- Calls to model providers over HTTP are client spans under the step that made them.
- A trace link in Studio opens the collector on the record's own time range
  (`VITE_TELEMETRY_TRACE_URL` takes `{from}` and `{to}`).
