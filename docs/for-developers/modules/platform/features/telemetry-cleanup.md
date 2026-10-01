# Telemetry — cleanup tracker

What is left after [telemetry](telemetry.md) (13.5) and [logging](logging.md) (13.4) shipped (T1–T8 on
`feat/trace-studio-to-engine`). Work only these; do not start new telemetry features from here.

**Status:** ✅ done · 🟡 open · ⏸ deferred on purpose · ❌ won't do.
**Size:** S = a one-file fix. If an S item grows, stop and re-scope it here first.

| # | Item | Where | Status | Size | Note |
|---|---|---|---|---|---|
| 1 | Flip index 13.5 (API · CLI · Studio) to ✅ | `docs/for-developers/README.md` | ✅ | S | T1–T8 done; the feature file's header too |
| 2 | Flip index 13.4 Logging (API) to ✅ | `docs/for-developers/README.md` | ✅ | S | C1–C10 built in T7; the CLI column is ✅ too — its logging is configured at import and lowered in place by `set_level("INFO")` |
| 3 | Telemetry back off in the dev containers | `docker compose up -d engine studio` | ✅ | S | both recreated with telemetry off; HyperDX left running with its data |
| 4 | Merge and release design-kit `feat/error-boundary-reports` | `../design-kit` | ⏸ | S | owner's call; `ErrorBoundary` `onError` + `fallback`; Studio uses the local kit until then |
| 5 | Push and open PRs | invana · design-kit | ⏸ | S | owner's call |
| 6 | Pool reconnect backoff never doubles | `engine/src/invana/apps/graphs/pool.py` (`_connect_graph`) | ✅ | S | a failed attempt cancelled its own retry task and started a new one at 1s; the retry loop now connects with `retry=False`, so delays go 1 → 2 → 4 … |
| 7 | CLI exit takes ~19s with the collector down | `core/telemetry/setup.py` (`shutdown_telemetry`) | ✅ | S | the providers' exit hooks are unregistered and shut down within the 5s budget; measured 20s → 6s (collector up: under 1s) |
| 8 | Dev DB run `f4a26cc5-…` left crashed | dev database | ✅ | S | deleted with its step and stream rows (they cascade); the audit events that mention it stay |
| 9 | Graph-connector metric label is the class name; `operation` is always `query` | `engine/src/invana/graph/connectors/base/connector.py` | ⏸ | S | no dashboard needs it — `Neo4jConnector` reads fine, and renaming would split the series |
| 10 | OTLP log handler ships `trace`, `log_fields`, `trace_id`, `span_id` as redundant attributes | `engine/src/invana/core/telemetry/setup.py` | ✅ | S | a last filter on the OTLP handler ships a copy of the record without them; the console handler still sees them |
| 11 | The 5xx "already logged" key is spelled in two middlewares | `core/telemetry/middleware.py` · `server/middleware.py` | ✅ | S | one `ERROR_LOGGED` in `core/logging/context.py`, which imports no OpenTelemetry; both middlewares import it |
| 12 | The graph page's main-region boundary does not reset on a tab switch | `studio/src/pages/graphs-detail/GraphDetailPage.tsx` | ⏸ | S | resetting would remount the tab strip; leaving the screen recovers it |
| 13 | `graphs` on "startup finished" counts connections started, not connected | `engine/src/invana/server/app.py` | ⏸ | S | stated in the docs |
| 14 | Exemplars on Studio `ui.*` histograms | browser OpenTelemetry SDK | ❌ | — | the SDK does not record them; Studio latency links through its spans |
| 15 | `system.schedule` root span | — | ⏸ | M | lands with the scheduler |
| 16 | Fold the graph connector's and LLM client's own OpenTelemetry fallbacks into `core/telemetry/spans.py` | refactor R5 | ⏸ | M | refactor track |
| 17 | `ui.boards.open` action span | refactor R2–R4 | ⏸ | S | lands with the Boards view panel |
| 18 | Studio metrics lost when a Playwright context closes before `pagehide` | `studio/src/services/telemetry/setup.ts` | ❌ | — | test-harness only; a real tab close flushes |
| 19 | Stray asyncio mark on a sync test | `engine/tests/sessions/test_services.py` | ✅ | S | the module-level mark was redundant under `asyncio_mode = "auto"`; removed |
| 20 | Broken `guides/running-*.md` links in the public docs | `docs/docs` | ✅ | S | links to the unpublished guides removed, the drafts link each other's `_` files, *Connecting to Neo4j* points at the quickstart; `mkdocs build` has no warnings |
| 21 | `TEST_CONNECTOR_CLASS` in the graphs test fixtures names a module that no longer exists | `engine/tests/graphs/conftest.py` | ✅ | S | now `invana_neo4j.connector.Neo4jConnector`; the backoff test uses it instead of its own copy |
| 22 | The CLI rebuilt its logging after telemetry started, dropping the OTLP log handler (so CLI logs never reached the collector) and flushing it on a non-daemon thread | `cli/main.py` · `core/logging/config.py` (`set_level`) | ✅ | S | found while fixing 7; the CLI lowers its level in place |
