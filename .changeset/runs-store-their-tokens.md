---
"invana": minor
---

Token totals are the engine's. Every run and step stores `tokens`, and a settled run stores `run_tokens_in`, `run_tokens_out` and `run_tokens` — its own spend plus its steps'. The run list, trace, step rows, change history (`tokens`, `tokens_per_run`), activity tree and touches return them, and Studio shows them instead of adding `in + out`. Existing runs are backfilled by the migration.
