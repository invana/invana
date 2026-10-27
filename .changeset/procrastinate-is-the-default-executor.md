---
"invana": minor
---

Tool steps run in workers by default: `INVANA_EXECUTOR` now defaults to `procrastinate`.

A tool step is queued on `tools.<labels>` and runs only when an `invana worker` carrying that label
has joined the engine. With no such worker, the step fails `transient · worker_unavailable` after
its allowance. Set `INVANA_EXECUTOR=inline` to run every step in the engine process.
