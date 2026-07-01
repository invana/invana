# HyperDX dashboards

Local HyperDX (the `telemetry` compose profile) stores dashboards in **ephemeral
container state** — `docker-compose-infra.yml` mounts no data volume for the
`hyperdx` service — so anything built in the UI is lost on `down`/recreate. The
dashboards we care about are therefore rebuilt from code here.

## Messages API & Performance

`seed-messages-dashboard.py` creates the **"Invana — Messages API & Performance"**
dashboard: message API call volume / latency (p50/p95/p99) / error rate, an
endpoint breakdown, the slowest recent calls, LLM- and graph-query-time p95, and a
top-5 slowest engine stages panel. Every tile is a raw-SQL tile over `otel_traces`
(service `invana-engine`); the perf panels read the child spans the engine emits
(`llm.generate`, `graph.query.db_execute` — RFC-025/041).

### Run

```bash
# 1. bring up the telemetry stack (once)
docker compose -f docker-compose-infra.yml --profile telemetry up -d

# 2. drive some traffic so there's data (send a few session messages in Studio)

# 3. (re)create the dashboard — idempotent, discovers source/connection IDs itself
python3 docker/hyperdx/seed-messages-dashboard.py
# → prints:  open: http://localhost:8080/dashboards/<id>
```

Re-running deletes the same-named dashboard first, so it never duplicates. Point it
at a non-default host with `HYPERDX_URL=http://host:8080`.

> Inspecting the raw data by hand? See the `hyperdx-clickhouse-access` note — the
> read-only `invana_ro` / `invana_ro` ClickHouse user on `http://localhost:8123`.
