---
"invana": patch
"studio": patch
---

Seven HyperDX dashboards, grouped like the product: API, Runs, LLMs, Graph queries, System, Studio, and a Trace view that opens a Studio action's whole trace. Seed them with `python3 docker/hyperdx/seed-dashboards.py`; `--check` runs every tile against ClickHouse. The "Invana — API Performance" dashboard is replaced. A new Telemetry page in the deployment docs covers turning telemetry on, its settings and what is recorded.

Studio no longer reports GitHub's rate limit on the star badge as an error.
