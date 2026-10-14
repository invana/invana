---
"invana": minor
---

Skills and agents keep eval sets, and a draft is evaluated before it publishes.

- `GET|PUT …/evals/{skill|agent}/{id}` reads or writes the set: its cases, the judge's pinned model and the rubric. A judge pinned to the model under test is refused, naming both.
- `POST|PATCH|DELETE …/evals/{skill|agent}/{id}/cases[/{case_id}]` writes cases. Each case is a question with rule checks: `cites_records`, `names_world`, `cannot_answer`, `guardrail_holds`, `expected_records`, `max_tokens` and `max_latency_ms`. A proposed case replays only after a person accepts it.
- `POST …/evals/{skill|agent}/{id}/runs` `{side: live|draft|both}` opens an eval run and returns 202. It replays every active case as an ask, then records each case's checks, tokens, latency and judged score. `GET …/runs[/{run_id}]` reads the runs and their results.
- Publishing a skill or an agent's instructions, rolling either back, and moving an agent's pin each read the newest eval run over that exact candidate. Each is refused `409` when the set has active cases and no such run exists (`eval_required`), while that run is still going (`eval_running`), or when a hard check failed (`eval_failed`). A run that warns, with tokens or p95 more than 20% over live or a judged mean 0.5 lower, needs a `why` (`eval_warned`). The verdict is kept on the publish event.
- `POST …/evals/promote` makes a real ask a passing or failing case. Only a person can promote.
- `POST …/evals/drift` `{trigger}` re-runs every live set. A run that falls behind the last one emits `eval.degraded`.
- `GET|PUT …/evals/budget` sets a monthly eval budget in tokens. When it is reached, drift runs settle *paused: budget*.
