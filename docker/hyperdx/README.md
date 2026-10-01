# HyperDX dashboards

Local HyperDX (the `telemetry` compose profile) keeps state in two stores, both
on named volumes so they survive `restart`, `down` and container recreates:

| Volume | Mount | Holds |
|---|---|---|
| `hyperdx-data` | `/var/lib/clickhouse` | traces, logs, metrics |
| `hyperdx-mongo-data` | `/data/db` | sources, saved searches, **dashboards** |

The dashboards are still built from code here, so they are reviewable and the
same on every machine. A dashboard that exists in one developer's container only
is not one anybody can rely on.

> The service is behind the `telemetry` profile: a plain `docker compose up -d`
> does **not** start it — pass `--profile telemetry`.

## Invana dashboards

`seed-dashboards.py` creates seven dashboards, grouped like the product's modules
(docs/for-developers/modules/platform/features/telemetry.md § Dashboards):

| Dashboard | Answers |
|---|---|
| Invana — API | how many requests, how many 5xx, which routes are slow; a 5xx opens its trace |
| Invana — Runs | runs by outcome, kind and trigger; active runs; slowest steps; each failed run with its kind and trace |
| Invana — LLMs | calls, failures, tokens and cost by provider and model; slowest calls |
| Invana — Graph queries | queries by connector, language and outcome; result sizes; slowest queries |
| Invana — System | background loops, the graph pool, open streams, events, startups, warnings and errors |
| Invana — Studio | actions, requests, Web Vitals and errors by module |
| Invana — Trace | recent and slowest Studio actions — a row opens the whole trace, Studio to engine to database |

```bash
# 1. bring up the stack with telemetry on (once)
INVANA_TELEMETRY_ENABLED=true VITE_TELEMETRY_ENABLED=true docker compose --profile telemetry up -d

# 2. use Studio for a minute so there is data

# 3. (re)create the dashboards — idempotent, discovers source/connection ids itself
python3 docker/hyperdx/seed-dashboards.py

# 4. after renaming a metric or an attribute: every tile's SQL must still run
python3 docker/hyperdx/seed-dashboards.py --check
```

Re-running replaces the same-named dashboards and removes the retired
"Invana — API Performance". Point it elsewhere with `HYPERDX_URL`, and `--check`
with `CLICKHOUSE_URL` · `CLICKHOUSE_USER` · `CLICKHOUSE_PASSWORD` (default: the
read-only `invana_ro` / `invana_ro` user on `http://localhost:8123`).

## Canvas dashboards

`seed-canvas-telemetry-dashboards.py` creates the two `@invana/canvas` dashboards
(frame rate and gestures), from the canvas's own telemetry. Same mechanics.
