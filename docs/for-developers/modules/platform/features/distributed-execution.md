# Distributed execution

System design: [runtime.md](../../../../../specs/system-design/runtime.md) — the `TaskEnvelope`, `run_envelope()`, the idempotency key, workers through the engine's gateway, procrastinate as the executor and its seams (§ Executor and workers). This file keeps the benchmark, the engine paths and the build plan.

## The benchmark

`engine/benchmarks/executors/` — `uv run --with … python benchmarks/executors/bench.py <executor>`;
results in `results/<executor>.json`. Every executor runs the same envelopes through the same
`run_envelope`; nothing is added to the engine's dependencies.

| Setting | Value |
|---|---|
| Machine | one laptop, 18 cores, macOS; Postgres 18 and Redis 7 in Docker on the same host |
| Workers | 1, 3, 9 processes, each its own process group, one task at a time (concurrency 1) |
| `bench.graph_query` | stands in for an `execute_graph_query` lane: 50 ms I/O wait + a 2 000-row JSON encode. **No graph database touched** |
| `bench.llm_step` | stands in for an LLM call: 1 s I/O wait. **No model called, no tokens spent** |
| Fan-out | 200 `graph_query` lanes + 20 `llm_step`, sent at once; ideal = 30 s of work ÷ workers |
| Throughput | 1 000 no-op envelopes sent at once (batched where the executor batches) → tasks per second to drain |
| Dispatch latency | 30 envelopes one at a time to idle workers → send-to-start, p50 / p95 |
| Kill | the fan-out on 3 workers; one worker SIGKILLed after 80 envelopes finished |
| Recovery tuning | procrastinate: heartbeat 2 s, a reaper requeues jobs whose worker is silent 10 s · Dramatiq: `heartbeat_timeout` 10 s, `maintenance_chance` 100 000 (defaults 60 s and 1 000) · Prefect: no setting exists |
| Ledger | each finished envelope writes one row keyed by its idempotency key; a second write of a key is a duplicate execution |

### Results

| | procrastinate 3.10 | Dramatiq 2.2 (Redis) | Prefect 3.8 |
|---|---|---|---|
| Throughput, tasks/s — 1 · 3 · 9 workers | 409 · 716 · 1 309 | 218 · 499 · 963 | 2.5 · 1.8 · 1.8 — bound by sending |
| Fan-out makespan, s — 1 · 3 · 9 (ideal 30 · 10 · 3.3) | 31.3 · 10.9 · 4.3 | 30.8 · 10.6 · 4.2 | 41.6 · 76.7 · 77.6 |
| Fan-out efficiency — 1 · 3 · 9 | 0.96 · 0.92 · 0.77 | 0.97 · 0.94 · 0.79 | 0.72 · 0.13 · 0.04 |
| Dispatch latency p95, ms — 1 · 3 · 9 | 7.2 · 7.5 · 10.0 | 16.8 · 10.3 · 17.4 | 50.3 · 48.5 · 50.4 |
| Worker killed mid-run: lost · duplicates | 0 · 0 | 0 · 0 | **2** · 0 |
| Kill → last envelope done | 13.4 s (reaper at 10 s) | 13.3 s (tuned); defaults not run — the 60 s heartbeat is its floor | never — 2 envelopes still unfinished 900 s after the kill |
| Idle worker memory | 185 MB | 233 MB | 222 MB |
| Send 1 000 envelopes | 0.08 s (one batched insert) | 0.29 s | 398–544 s — one API call per `.delay()`, 0.4–0.5 s each |
| Services it adds | **none** — the app's Postgres | Redis (or RabbitMQ) | a Prefect server and its database |
| Recovery comes from | a reaper the engine runs (≈ 10 lines) | the broker, once tuned | nothing — a dead task worker's task runs stay running |

Efficiency at 9 workers is bounded by the workload, not the queue: 20 one-second LLM steps over 9
workers take at least three rounds. procrastinate and Dramatiq land within 0.02 of each other at every
worker count.

Prefect's server ran on its default SQLite. A Postgres-backed server would send faster, but every
`.delay()` stays an HTTP round trip to a second service, against one batched insert for
procrastinate — and losing a dead worker's envelopes does not depend on the database.

## Engine paths

| Path | Holds |
|---|---|
| `plugins/envelope.py` | `TaskEnvelope` · `out_to_json` · `out_from_json` |
| `plugins/worker.py` | `run_envelope()` · the `Contexts` protocol |
| `runtime/executor.py` | `envelope_for(row, v)` · `InlineContexts` · `RebuiltContexts` · `_dispatch` (inline, through `run_envelope`) |
| `runtime/interpreter/loop.py` | `TaskRuntime.run_vars(db, th)` — the run's vars from its row, used by the pass and by `RebuiltContexts` |
| `plugins/sdk/context.py` | `TaskContext.idempotency_key` |
| `benchmarks/executors/` | the harness: `workload.py` and one adapter per executor |

## Plan

| # | Plan |
|---|---|
| DE10 | **B2–B5 of the executor benchmark are the gateway's acceptance tests.** Dial-out with no database route, the 700-agent run, a killed worker and a killed orchestrator are measured as part of F06; a failure that the gateway cannot close reopens the executor choice. Orchestrator take-over after a crash is scale-out work (a leased orchestrator), not F06's. |
| Not building yet | A worker process, `invana worker`, procrastinate as the `workers` extra, the wire forms — built in [13.12 Tool plugins](tool-plugins.md) · routing envelopes to resource pools (GPU, `sim.*`) — later, one pool until a plugin declares `gpu` · Celery, RQ, Temporal, Arq — not in the shortlist |
