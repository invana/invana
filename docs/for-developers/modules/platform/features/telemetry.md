# Telemetry

Traces, metrics and logs for everything a person or the system does, in Studio and the engine. One
trace per action, from the click to every query, model call and record it caused; metrics that link
back to it; logs that carry it. Over OTLP, entirely optional: with no collector configured Studio and
the engine behave identically.

| | |
|---|---|
| Index | [13.5](../../../README.md#13--platform) · Slice **S1** |
| Module | [Platform](../spec.md) |
| API / CLI / Studio | 🟡 / 🟡 / 🟡 |
| Related | [logging](logging.md) · [observability](../../operate/features/observability.md) · [audit-and-activity](../../operate/features/audit-and-activity.md) · [runtime](runtime.md) |

> **As** whoever operates this, **I want** one trace to follow a person's action from Studio through
> the engine, the runs it starts and the records it writes, **so that** a slow or failed action is a
> trace I open, not a guess I make across three tools.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | OTLP | gRPC from the engine; HTTP from Studio through the engine's proxy |
| C2 | Instrumentation layers | HTTP · app-state SQL · graph queries · model calls · runs and their steps · outbound HTTP |
| C3 | Pure ASGI middleware | not the wrapping kind, which breaks streaming and background work |
| C4 | Metrics namespaced by domain | API · graph query · app-state query · model operations · methods |
| C5 | Logs carry the trace id | console, JSON and OTLP logs alike |
| C6 | Idempotent bootstrap | calling it twice does nothing the second time |
| C7 | Optional | no endpoint configured means no exporter, no overhead, no error |
| C8 | One trace per user action | rooted in Studio, named for the action, ended when its outcome arrives |
| C9 | Streams stay in the trace | the SSE connections that deliver an answer or the event tail join the action's trace |
| C10 | Runs stay in the trace | a run, each of its Tasks and every delegated child run are spans of the action that started them |
| C11 | Who and from where | every root and request span says which principal acted, on whose behalf, from which origin, in which Graph |
| C12 | A record opens its trace | a TaskRun and an event carry the trace they were written in |
| C13 | The system's own work is traced | background loops, startup, schedules and CLI commands each open their own root |
| C14 | Sampling is stated | one ratio, parent-based, recorded on the resource |
| C15 | Metrics for everything that repeats | requests, runs, steps, tokens and cost, graph queries, streams, events, loops, pools — and in Studio, Web Vitals, actions, requests and errors |
| C16 | A metric opens a trace | exemplars on every histogram point at a sampled trace |
| C17 | Logs for discrete facts | run lifecycle, loop failures, startup, errors — each with its trace and span id |
| C18 | Studio sends its errors | uncaught errors, unhandled rejections, error boundaries and failed queries, as OTLP logs |
| C19 | One privacy rule for all three | ids, shapes and timings; never record contents, prompts, answers or credentials |

## Journey

```mermaid
sequenceDiagram
    actor P as Person
    participant S as Studio
    participant E as Engine (HTTP)
    participant R as Runtime
    participant X as Graph DB · LLM
    participant C as Collector
    P->>S: Ask
    Note over S: ui.assistant.ask starts (root)
    S->>E: POST …/ask  (traceparent)
    Note over E: SERVER span · enduser.id · principal · origin · graph
    E->>R: submit run
    Note over R: invana.run (same trace, outlives the request)
    E-->>S: 202
    S->>E: SSE …/runs/{id}/stream?traceparent=…
    R->>X: invana.run.step → graph.query / llm.generate
    R-->>S: frames … terminal frame
    Note over S: ui.assistant.ask ends
    S->>C: browser spans via /api/v1/telemetry/traces
    E->>C: engine spans (OTLP gRPC)
```

```mermaid
flowchart TD
    A[Work nobody clicked] --> B{Origin}
    B -->|background loop| C[system.<loop> root per iteration]
    B -->|startup| D[system.startup root]
    B -->|schedule firing| E[system.schedule root → invana.run]
    B -->|CLI command| F[cli.<command> root → invana.run]
    C --> G[principal · origin on the root]
    D --> G
    E --> G
    F --> G
```

## Seams

| Seam | What you see |
|---|---|
| Collector unreachable | Studio and the engine keep serving; export failures never surface as request errors |
| Bootstrapped twice | the second call is a no-op |
| A streaming response | the middleware measures it without buffering it |
| An SSE connection | `EventSource` cannot send headers, so Studio puts `traceparent` in the URL and the middleware reads it there when the header is absent |
| A run outlives its request | the run span is a child of the request span and ends when the run ends; the request span ends at 202 |
| A delegated child run | a child span of the parent run, with a Link to it |
| A call with no action open | it starts its own root, so no engine span is ever an orphan |
| Sampling on | parent-based: a sampled action keeps its whole trace, runs and streams included; the ratio is on the resource, so a missing trace is explainable |
| Engine telemetry off, Studio's on | the browser-span proxy answers 202 and drops the batch — the console stays clean |
| An access token in a URL | stripped before the URL is recorded — no span attribute or access-log line ever holds a credential |
| A 5xx | one error line, whichever middleware sees it — with the route template and the trace when telemetry is on, from the catch-all when it is off |
| A 4xx in Studio | not sent as an error log — the screen handles it, and `ui.request.duration` counts it |

## Surfaces

| Surface | Shape |
|---|---|
| Studio action spans | `ui.<module>.<action>` — the module names of [module-structure.md](../../../module-structure.md) §2: `ui.assistant.ask` · `ui.assistant.rerun` · `ui.explorer.load` · `ui.runs.cancel` · `ui.plans.promote` · `ui.events.subscribe`; `ui.boards.open` lands with the Boards view panel |
| HyperDX | seven dashboards seeded by `docker/hyperdx/seed-dashboards.py` (§ Dashboards) and HyperDX's own service map across `invana-studio` and `invana-engine` |
| A run's drawer | a `trace` row in *The run* — the id, a link into the collector's trace view when `VITE_TELEMETRY_TRACE_URL` is set, plain text otherwise; an event's `trace` row reads the same |

## Engine

| Thing | Shape |
|---|---|
| Transport | OTLP gRPC; `INVANA_TELEMETRY_OTLP_ENDPOINT` · `INVANA_TELEMETRY_SAMPLE_RATIO` (0–1, default 1.0) · resource attributes from settings |
| Studio's proxy | `INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT` is the collector's OTLP/HTTP **base** URL (`http://hyperdx:4318` in compose); `POST /api/v1/telemetry/{traces,metrics,logs}` forwards to `<base>/v1/{traces,metrics,logs}` |
| Metrics | exported every few seconds; histograms carry exemplars from sampled spans (trace-based filter), so a slow bucket opens one of its traces |
| HTTP | pure ASGI middleware; `traceparent` (and `tracestate`) from the header, else from the query parameters of the same name — the header wins; query string recorded with `token` removed; every `/api/v1/telemetry/` proxy path not traced; the only source of request spans |
| Attributes | `enduser.id` · `invana.principal` (`user · agent · system · external · anonymous`) · `invana.on_behalf_of` · `invana.origin` (`studio · api · cli · schedule · startup · daemon`) · `invana.graph` (`user/graph`) · `invana.graph_id` · `invana.run_id` · `invana.outcome` |
| Who, on a request | the middleware starts every request `anonymous` from `api`; authentication sets `enduser.id` and principal `user`, with origin `studio` for a session token and `api` for a personal access token; resolving a Graph URL sets `invana.graph` and `invana.graph_id` |
| Runs | `invana.run` per run (`invana.run_id` · `invana.agent_id` · `invana.run.role` · `invana.run.kind` · `invana.run.triggered_by` · `invana.graph_id` · principal `agent` or `user` · `invana.on_behalf_of` · `invana.outcome`); `invana.run.step` per attempt (`invana.task_key` · `invana.step_key` · `invana.run.attempt` · `invana.outcome`). Cannot-answer, conversed and needs-input are outcomes, not errors; a failed step or crashed run is an error; a cancelled run is outcome `cancelled`. Queue wait is the `run.queued` and `run.admitted` events on the run span |
| Graph · model · SQL | `graph.query.*` · `llm.generate` · SQLAlchemy spans, nested under the step that caused them |
| Outgoing HTTP | every httpx call is a client span under whatever caused it — a model provider's request under its step; the telemetry proxy's forward to the collector is not traced, or every browser batch would become a root |
| Records | `task_runs.trace_id` — read off the current span at insert, else filled when the run's span opens · `task_runs.root_span_id` — the run's `invana.run` span; the first run span wins, so a resumed run keeps both; a step row has `trace_id` only. `events.trace_id` · `events.span_id` — filled by `emit` from the current span, never passed by a caller; null outside any span. `trace_id` is on `GET …/runs/{id}` and `GET …/runs/{id}/trace`, `span_id` on every event read |
| Roots nobody clicked | each a new trace (`context=Context()`), never a child of whatever spawned it, principal `system` unless said: `system.startup` (origin `startup`) — connecting the Graphs, seeding, the sweep that fails runs a dead process left mid-flight · `system.graph_health` per health sweep (`invana.graph.connections`; outcome `ok` · `degraded`, a failed check an event on it; an empty registry opens none) · `system.graph_reconnect` per reconnect attempt (`invana.graph_id` · `invana.connection_id`; `ok` · `failed` · `stopped`) · `system.events_listen` per LISTEN connect · `system.query_log` per batch written and `system.query_log.prune` — all origin `daemon` · `cli.<command path>` (origin `cli`, principal `user`, `invana.cli.command`) · `system.schedule` when a scheduler fires, which lands with the scheduler |
| CLI | the root group opens `cli.users.create` and the like — never for `start`, which traces as a server, or `--help`; SQLAlchemy is instrumented process-wide, and the three signals are flushed on exit within 5 seconds |
| Queues | a producer's span context rides the item; the consumer's span Links to it — a logged graph query carries the span it was asked in, and `system.query_log` links to each (at most 128 per batch) |
| Logs | a logging filter sets `trace_id` / `span_id` and the bound `principal` · `origin` · `graph_id` on every record — plain shows `[trace_id span_id] principal=… origin=… graph_id=…`, JSON and OTLP add them as fields; the fields are bound by the same `spans` helpers that set `invana.principal` · `invana.origin` · `invana.graph_id`, so a line and its span agree, with or without the extra. A redaction filter on every handler applies the events rule to a record's fields. uvicorn's access log has `token` stripped; the per-request line is debug |
| Log lines | `run started` · `run finished` · `run paused for a person` · `run cancelled` (info) · `run failed` (error, `failure_kind` = `class·cause`; an escaped exception once, with its traceback, as `defect·internal`) — each inside the run span, with `run_id` · `run_kind` · `run_role` · `run_triggered_by` · `run_outcome` · `run_duration_s` · `graph went down` (warning) · `graph came back` (info) · `startup finished` (info) · a 5xx (error: method, route template, status, duration; never the body) |

## Studio

| Thing | Shape |
|---|---|
| Providers | traces (`WebTracerProvider`, parent-based sampler on `VITE_TELEMETRY_SAMPLE_RATIO`), metrics and logs — service `invana-studio`, exported through `/api/v1/telemetry/{traces,metrics,logs}` |
| Web Vitals | the `web-vitals` package, recorded as `ui.web_vitals.*` |
| Errors | `reportError(error, source)` — one OTLP log (severity error; `exception.type` · `exception.message` · `exception.stacktrace` · `module` · `ui.error.source`) in the failed request's trace when it has one, else the active one, and one `ui.errors`. Sources: the window's `error` and `unhandledrejection` handlers, the query and mutation caches' `onError` (network errors and 5xx only), the router's error page (not a 404), and the kit's `ErrorBoundary` around each shell region (`leftSection`, `mainSection`, `rightSection`) with `onError={reportBoundaryError}` — a side region is keyed by its open panel and the graph-less shell's main by its path, so opening another starts it afresh |
| Actions | `startAction(module, action)` opens a new root; the handle's `end(outcome)` / `fail(err)` ends it once, recording `invana.outcome` — the terminal stream frame for an ask or a re-run (`run.done` · `run.cancelled` · `clarification.requested`; a lost stream is an error), the response for a write |
| Requests | every API call is a client span, parented explicitly by the action passed in the request config — never by a shared "current action" slot |
| Streams | `traceparent` appended to every `EventSource` URL — a run's tail carries its action's; the events tail, which nobody clicked, opens a `ui.events.subscribe` root that ends when the connection opens or fails |
| Attributes | `enduser.id` · `invana.graph` (`user/graph`) · `invana.session_id` · `invana.run_id` · `invana.outcome` on action spans; never record contents |
| Trace link | `VITE_TELEMETRY_TRACE_URL` — the collector's trace view with `{trace_id}`, and optionally `{from}` · `{to}` (epoch ms): the record's time ± 15 minutes — a run's start to its finish, or to now while it runs; the last day when nothing says when. The compose stack points it at HyperDX search (`isLive=false`) |
| Tests | Vitest in Node (`pnpm test`), spans captured by an in-memory exporter |

## Metrics

Names follow the modules and, for HTTP and databases, the OpenTelemetry semantic conventions. Durations
are histograms in seconds. The engine defines every instrument in `core/telemetry/metrics.py` and records
through `core/telemetry/recorders.py`, whose functions are no-ops without the telemetry extra.
Attributes are bounded: a metric never carries a user id, a run id or a Graph id — those are on spans
and logs, and per-Graph product numbers come from the record ([observability](../../operate/features/observability.md) OB1).

| Metric | Kind | Attributes |
|---|---|---|
| `http.server.request.duration` | histogram | `http.request.method` · `http.route` · `http.response.status_code` |
| `http.server.active_requests` | up-down counter | `http.request.method` · `http.route` |
| `invana.runs.duration` · `invana.runs.queue_wait` | histogram | `kind` · `role` · `triggered_by` · `outcome` (duration only) |
| `invana.runs.count` · `invana.runs.active` | counter · up-down counter | `kind` · `role` · `triggered_by` · `outcome` (count only) |
| `invana.runs.step.duration` | histogram | `step_key` (the catalogue's task key — a plan's own step ids are unbounded) · `outcome` |
| `invana.llms.request.duration` · `invana.llms.request.count` | histogram · counter | `provider` · `model` · `role` · `outcome` |
| `invana.llms.tokens` · `invana.llms.cost` | counter | `provider` · `model` · `direction` (`input · output`, tokens only) |
| `invana.graph_connectors.query.duration` · `.count` · `.result_size` | histogram · counter | `connector` (the connector class) · `language` · `operation` (`query`) · `outcome` |
| `invana.assistant.streams.active` | up-down counter | `stream` (`run · events`) |
| `invana.events.emitted` | counter | `action` |
| `invana.system.loop.duration` · `.failures` | histogram · counter | `loop` |
| `invana.graphs.pool.connections` | observable gauge | `state` (`healthy · backoff · down`) — connected · a retry is running · the retry ended without connecting |
| `ui.action.duration` | histogram | `module` · `action` · `outcome` |
| `ui.request.duration` | histogram | `http.route` · `outcome` |
| `ui.web_vitals.{lcp,inp,cls,ttfb}` | histogram | `module` |
| `ui.stream.reconnects` · `ui.errors` | counter | `stream` · `module` and `source` (`uncaught` · `unhandled_rejection` · `boundary` · `route` · `query` · `mutation`) |
| `ui.canvas.layout.duration` · `ui.canvas.render.duration` | histogram | `layout` · `size_bucket` — recorded by `@invana/canvas`, not by Studio |

## Dashboards

`docker/hyperdx/seed-dashboards.py` seeds them; `--check` runs every tile's SQL against ClickHouse and fails on any error.

| Dashboard | Tiles | Reads |
|---|---|---|
| Invana — API | requests · 5xx · 5xx rate · p95; requests by status class over time; active requests; p95 and 5xx by route; each 5xx (opens its trace) | `http.server.*` · `SERVER` spans |
| Invana — Runs | runs · failed · p95 run · mean queue wait; by outcome, kind and trigger; active runs; runs over time by outcome; slowest steps by `task_key`; each failed run with `failure_kind` (opens its trace) | `invana.runs.*` · `invana.run` / `invana.run.step` spans · run logs |
| Invana — LLMs | calls · failed · tokens · cost; calls and mean by provider and model; tokens by model and direction; p95 over time; slowest calls (open their trace) | `invana.llms.*` · `llm.generate` spans |
| Invana — Graph queries | queries · failed · p95; by connector, language and outcome; mean result size; p95 over time; slowest queries (open their trace) | `invana.graph_connectors.*` · `graph.query.db_execute` spans |
| Invana — System | loop failures and mean duration by loop; pool connections by state; open streams; events by action; `system.*` / `cli.*` roots; warnings and errors by line; startups (open their trace) | `invana.system.*` · `invana.graphs.pool.connections` · `invana.assistant.streams.active` · `invana.events.emitted` · spans · logs |
| Invana — Studio | actions · errors · p95 action; actions by name and outcome; requests by route; Web Vitals by module; errors by module and source; recent errors (open their trace) | `ui.*` · `ui.*` spans · Studio logs |
| Invana — Trace | recent and slowest `ui.*` actions with their engine span and error counts (a row opens the whole trace); engine spans under actions by total time | spans joined on `TraceId` |

## Logs

| Source | What is logged | Level |
|---|---|---|
| Engine, every record | `trace_id` · `span_id` in console, JSON and OTLP; `principal` · `origin` · `graph_id` as fields when known | — |
| Run lifecycle | started · finished · failed (with failure kind) · cancelled · paused for a person | info · error |
| System work | a loop iteration that failed; startup and its sweep; a graph pool going down or coming back | warning · error · info |
| Requests | a 5xx, with its route and trace — never the body; every other request at debug | error |
| Studio | uncaught errors, unhandled rejections, the router's error page, failed queries and mutations (network or 5xx), React error boundaries — through `POST /api/v1/telemetry/logs` | error |

Redaction happens at write, by field name and type, the same rule as events ([audit-and-activity](../../operate/features/audit-and-activity.md) AA4): one rule, `core/redaction.py`, applied to an event's details and to every log record's fields.

## Decisions

| # | Decision |
|---|---|
| TE1 | Telemetry is optional; Studio and the engine run identically without a collector. |
| TE2 | Bootstrap is idempotent. |
| TE3 | Middleware is pure ASGI, so streaming and background work are not broken. |
| TE4 | Metrics are namespaced by domain. |
| TE5 | This is operator telemetry. Product metrics a user reads come from the record — [observability](../../operate/features/observability.md). |
| TE6 | The browser-span proxy (`POST /api/v1/telemetry/traces`) is always mounted. Studio exports on its own gate (`VITE_TELEMETRY_ENABLED`); with engine telemetry off the route accepts the batch and drops it. |
| TE7 | One user action is one trace, rooted in Studio and named `ui.<module>.<action>`. It ends when the action's outcome arrives, not when its first request returns. |
| TE8 | Every Studio API call is a span with an explicit parent; with no action open it is its own root. |
| TE9 | A stream joins its action's trace through a `traceparent` query parameter, read by the middleware only when the header is absent. |
| TE10 | A run is a child span of the request that started it and may outlive it; each Task is a child of its run; a delegated child run is a child span with a Link to its parent run. |
| TE11 | Who acted is recorded, never what they sent: principal, on-behalf-of, origin, Graph and ids are attributes; record contents, prompts and answers are not. |
| TE12 | Work nobody clicked starts its own trace, rooted per loop iteration, per startup, per schedule firing and per CLI command, with `invana.origin` saying which. |
| TE13 | A TaskRun stores its trace id and root span id; an event stores its trace id and span id, filled at emit from the current span — no caller passes them. A run's trace id is read at insert, else from its own run span; the first run span wins. |
| TE14 | No credential reaches a span or a log: `token` is stripped from recorded URLs and from the access log. |
| TE15 | Sampling is parent-based on one ratio from settings — 1.0 in dev and compose — and the ratio is on the resource as `invana.telemetry.sample_ratio`. |
| TE16 | The compose stack points both services at the bundled collector; service names are `invana-studio` and `invana-engine`. |
| TE17 | Three signals, one job each: traces say what happened to one action, metrics say how often and how slow across all, logs record discrete facts. The trace id joins them — exemplars on metrics, fields on logs. |
| TE18 | Metric names follow the modules (`invana.<module>.*`, `ui.*`) and OpenTelemetry semantic conventions for HTTP and databases. The per-status counters collapse into one counter with a status attribute; gremlin folds into graph-connector metrics with `connector` as an attribute; an ask is a run, so a session message is measured by `invana.runs.*` and `invana.assistant.*` holds the streams. The engine's unused method-level decorators and their instruments are not kept. |
| TE19 | A metric's attributes are bounded. User id, run id and Graph id are never metric attributes. A run's metrics use `triggered_by` (`user · schedule · task · delegation`), which the row records; the request's `origin` is on its span. HTTP metrics use the route template — an unmatched path is one fixed value, never the raw path. |
| TE20 | Studio measures Web Vitals with the `web-vitals` package. |
| TE21 | Studio sends errors only — uncaught errors, unhandled rejections, error boundaries, failed queries. Warnings and console output stay in the browser. |
| TE22 | The proxy has three routes — traces, metrics, logs — always mounted, each accepting and dropping when engine telemetry is off (TE6). |
| TE23 | The CLI emits the same three signals under `cli.<command>` and flushes them before it exits. The person at the shell is principal `user` with no `enduser.id` — the CLI holds no session to name them. |
| TE24 | The seeded HyperDX dashboards are grouped like the modules — API · Runs · LLMs · Graph queries · System · Studio — with one cross-service trace view. |
| TE25 | Studio links a trace id to the collector through one URL template, `VITE_TELEMETRY_TRACE_URL`, opening on the record's own time range, because a collector searches a window and not all of history. Without the template the id is shown and not linked — Studio never guesses a collector. |
| TE26 | A log line's `principal` · `origin` · `graph_id` are bound by the span helpers that set the matching attributes, so the two never disagree; a root span starts from none. The Graph is its id — the only form every source has. |
| TE27 | A request is logged at debug; a 5xx is logged once at error, by the request middleware inside its span when telemetry is on and by the catch-all when it is off. |
| TE28 | Studio sends a failed query or mutation only for a network error or a 5xx. A 4xx is an outcome the screen handles and is already measured. |
| TE29 | `ui.errors` carries `module` and `source`; a Studio error log is written in the failed request's trace when the error carries one, else in the active context. |
| TE30 | Redaction is one rule for events and logs: a sensitive field name is dropped at any depth, a secret-typed value is masked, and message text is never parsed — code does not format a secret into it. |
| TE31 | Dashboards read counts from metrics, which sampling does not thin; latency percentiles from span durations, which are exact and open the trace they came from; levels from each series' last value; discrete facts from logs. Engine metrics are cumulative and Studio's delta, and each count is read as its increase over the range. |
| TE32 | The dashboards are code: one seed script, idempotent by name, and a check that runs every tile's SQL so a renamed metric fails loudly instead of drawing nothing. Studio's `ui.*` histograms carry no exemplars — the browser SDK does not record them — so Studio latency links to traces through its spans. |

## Not building

| Not building | Because |
|---|---|
| A vendor-specific exporter | OTLP reaches every collector worth using |
| Telemetry as a hard dependency | Studio and the engine must run with none of it present |
| Tracing user data | spans carry shape, timing and ids, never record contents |
| Session replay or click heatmaps | an action is traced; a person is not recorded |
| Automatic instrumentation of every DOM event | a span is named for an action a person means, not for each click |
| Alerting and paging | the collector's job, as observability says |
| Browser console mirroring | noise; Studio sends errors only |
