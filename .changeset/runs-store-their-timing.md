---
"invana": minor
---

A run stores its own timing. Every run and step records `duration_ms` and `queue_ms` when it settles, and a run records `work_ms`, `ask_ms` and `wait_ms` — how its time went to steps, to waiting on a person, and to nothing. The API serves them on step rows, the trace, run lists, replies and simulations, and Studio shows them instead of working them out: an answer's meta line, a step's time, a run's elapsed, the log's offsets and a step's share of the run all read the engine's numbers. Existing runs are backfilled by the migration.
