---
"invana": patch
---

Fix: Ask stayed locked on a graph whose LLM provider was already configured and pinged.

`GraphManager.serialize` defaulted `setup_state` to the stored `graphs.setup_state` column
when no derived state was passed — and create, list, detail and update all passed none. That
column holds only skips and the instructions stamp, so every derived section came back
absent, which Studio reads the same as not done. A graph with a default provider and a
passing ping kept being told to add an LLM provider, and the same was true of the other
gates.

Every Graph read now composes through `SetupManager.graph_read` / `.graph_reads`, and
`serialize` takes `setup_state` as a required argument so the fallback cannot come back
(setup.md SU26).
