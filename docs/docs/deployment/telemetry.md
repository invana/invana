# Telemetry

Invana can send traces, metrics and logs to any OpenTelemetry collector. With
telemetry on, one action in Studio is one trace: the click, the engine requests
it makes, the run it starts, each step of that run, and the model calls and graph
queries they make. Metrics say how often and how slow across all actions, and logs
record discrete facts such as a run failing or a server error.

Telemetry is optional. With it off, Studio and the engine behave exactly the same
and send nothing.

## Turn it on

Local development ships a collector with a UI: HyperDX, under the `telemetry`
compose profile.

```bash
INVANA_TELEMETRY_ENABLED=true VITE_TELEMETRY_ENABLED=true \
  docker compose --profile telemetry up -d

python3 docker/hyperdx/seed-dashboards.py   # the Invana dashboards
```

Open HyperDX at <http://localhost:8080>.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `INVANA_TELEMETRY_ENABLED` | `true` (compose: `false`) | the engine sends traces, metrics and logs |
| `INVANA_TELEMETRY_OTLP_ENDPOINT` | `http://localhost:4317` | the collector's OTLP gRPC endpoint, used by the engine |
| `INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT` | `http://localhost:4318` | the collector's OTLP/HTTP base URL, used to forward what Studio sends |
| `INVANA_TELEMETRY_SAMPLE_RATIO` | `1.0` | the share of new traces kept, 0 to 1 |
| `VITE_TELEMETRY_ENABLED` | on unless `false` (compose: `false`) | Studio sends traces, metrics and errors |
| `VITE_TELEMETRY_SAMPLE_RATIO` | `1.0` | the share of Studio actions traced |
| `VITE_TELEMETRY_TRACE_URL` | unset | the collector's trace view, with `{trace_id}`, `{from}` and `{to}`; a run's trace id links there |

Studio never talks to the collector directly. It sends to the engine's
`/api/v1/telemetry/{traces,metrics,logs}`, which forwards to
`INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT` and drops the data when the engine's
telemetry is off.

Sampling follows the trace: a kept action keeps its whole trace, from Studio to
the database.

## What is recorded

| Signal | What it holds |
|---|---|
| Traces | who acted (user, agent or system), where from (Studio, API, CLI, startup, background work) and on which Graph; timings and outcomes. Never record contents, prompts, answers or credentials. |
| Metrics | requests, runs, steps, model calls with tokens and cost, graph queries, streams, events, background loops, the graph connection pool; in Studio, actions, requests, Web Vitals and errors |
| Logs | run started, finished, paused for a person, cancelled or failed; a graph connection going down or coming back; startup; each server error; Studio errors. Every line carries its trace id. |

Credential-named fields (`password`, `api_key`, `secret`, `token`, and anything
ending `_hash` or `_encrypted`) are removed from every log record before it is
written.

## Dashboards

| Dashboard | Answers |
|---|---|
| Invana — API | how many requests, how many server errors, which routes are slow |
| Invana — Runs | runs by outcome, kind and trigger; what is running now; the slowest steps; each failed run and why |
| Invana — LLMs | model calls, failures, tokens and cost by provider and model |
| Invana — Graph queries | queries by connector and language; result sizes; the slowest queries |
| Invana — System | background work, the graph connection pool, open streams, startups, warnings and errors |
| Invana — Studio | actions, requests, Web Vitals and errors by Studio module |
| Invana — Trace | recent and slowest Studio actions; a row opens the whole trace |

A row that names a trace opens it. A run's drawer in Studio shows its trace id,
which links to the collector when `VITE_TELEMETRY_TRACE_URL` is set.
