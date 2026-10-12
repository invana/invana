---
"invana": patch
---

Every step now runs through one call that a worker in another process can make too.

- A step leaves the interpreter as a `TaskEnvelope` — ids and args, all JSON — and is called by `invana.plugins.worker.run_envelope()`, which rebuilds the step's context from those ids. Runs behave as before; they still run in the engine process.
- A task type's declared `timeout_s` is now applied: a step that overruns it fails as transient with cause `task_timeout`.
- procrastinate, on the engine's own Postgres, is the chosen executor for running steps in workers; the benchmark that chose it is in `engine/benchmarks/executors/`.
