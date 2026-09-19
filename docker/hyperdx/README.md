# HyperDX dashboards

Local HyperDX (the `telemetry` compose profile) keeps state in two stores, both
on named volumes so they survive `restart`, `down` and container recreates:

| Volume | Mount | Holds |
|---|---|---|
| `hyperdx-data` | `/var/lib/clickhouse` | traces, logs, metrics |
| `hyperdx-mongo-data` | `/data/db` | sources, saved searches, **dashboards** |

Despite the "local" name, the image bundles the HyperDX API server and its
MongoDB — dashboards are stored server-side, not in browser localStorage. Before
those volumes existed every recreate silently wiped them, which is why the
dashboards we care about are rebuilt from code here. Keep it that way: a
dashboard that only exists in one developer's container isn't reviewable.

> Note: the service is behind the `telemetry` profile, so a plain
> `docker compose up -d` does **not** start it — pass `--profile telemetry`.

## API Performance

`seed-api-performance-dashboard.py` creates the **"Invana — API Performance"**
dashboard covering **message and query APIs** together:

- **Overview + quick stats** — call volume and p95 latency for message calls, graph
  queries, LLM calls, and explorer expands.
- **Over time** — call volume (messages vs expands) and p95 latency (message vs
  graph query).
- **By endpoint** — the query/message API family (`…/messages`, `…/run`,
  `…/explorer/expand/*`) with calls / p95 / errors.
- **Bottlenecks (top 5)** — slowest engine stages by total time, and slowest API
  routes by p95.
- **Traces** — slowest graph queries and a recent-calls table; **click any row to
  open its full trace** in the search view.

Every tile is a raw-SQL tile over `otel_traces` (service `invana-engine`); the perf
panels read the child spans the engine emits (`llm.generate`,
`graph.query.db_execute` — docs/for-developers/modules/platform/features/telemetry.md · docs/for-developers/modules/operate/features/observability.md).

### Run

```bash
# 1. bring up the telemetry stack (once)
docker compose --profile telemetry up -d

# 2. drive some traffic so there's data (send session messages / expand nodes in Studio)

# 3. (re)create the dashboard — idempotent, discovers source/connection IDs itself
python3 docker/hyperdx/seed-api-performance-dashboard.py
# → prints:  open: http://localhost:8080/dashboards/<id>
```

Re-running deletes the same-named dashboard first (and the older
"Messages API & Performance" one), so it never duplicates. Point it at a non-default
host with `HYPERDX_URL=http://host:8080`.

> Inspecting the raw data by hand? See the `hyperdx-clickhouse-access` note — the
> read-only `invana_ro` / `invana_ro` ClickHouse user on `http://localhost:8123`.
