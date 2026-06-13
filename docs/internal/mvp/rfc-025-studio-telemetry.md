# RFC-025: Studio Telemetry — end-to-end query→render tracing

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-11
**Related**:
- **RFC-007** (Telemetry — traces/metrics/logs) — establishes the engine's OpenTelemetry stack
  (FastAPI + SQLAlchemy auto-instrumentation, `@track`/`@capture_metrics`, OTLP gRPC → HyperDX). Its
  final non-goal — *"No frontend (Studio) tracing in this RFC"* — is exactly what this RFC adds. RFC-007
  stays the backend baseline; nothing in it changes except two new query child spans and one proxy route.
- **RFC-024** (Query Sessions) — the message endpoint
  (`POST /api/v1/u/{username}/{graphSlug}/sessions/{id}/messages`) and `execute_query` service are the
  request this trace follows. `QueryResponse` is the payload whose transform/render we time.
- **RFC-011** (Studio Explorer) — the page being instrumented: `ExplorerPage`, `ExplorerCanvas`,
  `@invana/canvas` (PixiJS 8) force layout.
- **MVP** — telemetry is the `Cross-cutting` line *"Telemetry — RFC-007"*. This RFC extends that line to
  `RFC-007 + RFC-025`; no new MVP slice.

---

## Problem / intent

When a query feels slow in the Explorer, we have no way to say **where** the time went. The backend has
rich traces (RFC-007), but they stop at the HTTP boundary — everything the browser does (the request
itself, deserializing the response, adapting it to the canvas shape, force layout, painting) is dark.
And the backend trace and any frontend timing would be **two unrelated traces**, so you couldn't follow
a single query from click to pixels.

**Intent:** add OpenTelemetry-Web to the studio and propagate W3C trace context on the message-API call,
so **one query is one distributed trace** spanning frontend → backend → frontend, viewable as a single
waterfall in HyperDX. Plus the two backend child spans that split DB time from serializer time, which
RFC-007 didn't break out.

Scope this pass: **the Explorer query→render path only.** A reusable studio SDK, but no whole-app
auto-instrumentation, route-load timing, or Web Vitals (deferred — see Non-Goals).

---

## What you can see at the end

One query in the Explorer produces **one trace** in HyperDX (`http://localhost:8080`). Opening it shows
this waterfall — each bar's length is that stage's real duration, and the service name flips from
`invana-studio` to `invana-engine` exactly at the network hop:

```
explorer.query.run                         FE  the whole user action: Run → pixels
│                                              attrs: explorer.mode, explorer.language
│
├─ HTTP POST …/sessions/{id}/messages       FE  XHR span (auto). Its bar = request transit +
│  │                                            server time + response transit. traceparent
│  │                                            header injected here → links the backend subtree.
│  │
│  └─ POST …/messages                        BE  FastAPI request span (existing, RFC-007)
│     │                                          ← service.name flips to invana-engine here
│     ├─ (SQLAlchemy spans)                   BE  session/message row reads+writes (existing)
│     │
│     └─ graph.query.db_execute              BE  NEW — raw driver round-trip to the graph DB
│        graph.query.serialize               BE  NEW — deserialize raw → GraphResponse
│              invana.graph.node_count / edge_count
│
├─ explorer.transform                        FE  NEW — dedupe nodes/edges by id (path queries repeat)
│        explorer.raw_nodes/raw_edges → node_count/edge_count
│
├─ explorer.adapt                            FE  NEW — map QueryResult → canvas GraphData
│
├─ explorer.layout                           FE  NEW — d3-force settle (runLayout promise)
│        explorer.node_count / edge_count
│
└─ explorer.render                           FE  NEW — first painted frame after layout settles
```

**The questions this answers at a glance:**

| You want to know… | Read this on the waterfall |
|---|---|
| Total Run→pixels latency | length of the root `explorer.query.run` bar |
| Network + transit cost | gap before the backend bar starts + tail after it ends, within the XHR bar |
| DB time vs serializer time (server) | `graph.query.db_execute` vs `graph.query.serialize` |
| Time lost to JS deserialize/dedupe | `explorer.transform` |
| Force-layout compute vs paint | `explorer.layout` vs `explorer.render` |
| Where the FE→BE handoff is | the span where `service.name` changes |
| How big the result was | `node_count` / `edge_count` attributes on the serialize, transform, and layout spans |

**Beyond a single trace, in HyperDX you can also:**
- Filter `service.name:invana-studio` to see only frontend spans across many runs.
- Sort traces by the root span's duration to find the slowest queries.
- Jump from any span to its correlated logs — the engine already injects `trace_id`/`span_id` into
  every log record (RFC-007).
- Compare two runs (small vs large result) side by side to see which stage scales with graph size.

---

## Design decisions

### D1. One distributed trace via W3C trace-context propagation
The studio injects a `traceparent` header on the message-API call. The engine's `FastAPIInstrumentor`
already extracts it by default, so the backend request span (and everything under it) becomes a child of
the frontend HTTP span — no backend change needed. CORS already allows the header (`allow_headers=["*"]`).

**Injection is explicit, in the API client — not auto-XHR instrumentation.** The original design relied on
`XMLHttpRequestInstrumentation` to create the HTTP span and inject `traceparent` off the *ambient* OTel
context. That doesn't work in this stack: the request is dispatched from inside TanStack Query's mutation
machinery, several `await`s removed from `handleRun`, and **no web context manager carries the active
context across those hops** — `ZoneContextManager` only bridges `await`s that are *down-levelled* to
`Promise.then` chains, whereas Vite/esbuild emit **native** async/await (tsconfig `target: ES2022`). The
result was every API call starting its own root trace and no `traceparent` reaching the engine (FE and BE
were two unrelated traces). So instead: the in-flight interaction is held in a module-level slot (set in
`startInteraction`, cleared in `endInteraction`), and an axios request interceptor reads it, opens an HTTP
**client** span as an explicit child of `interaction.ctx`, and `propagation.inject`s `traceparent` from
that span's context. Outside a run the slot is null, so the interceptor no-ops — other API calls stay
untraced (matches the Explorer-only non-goal). This needs no ambient-context propagation at all, so it's
immune to the async-boundary problem.

### D2. Browser export proxied through the engine (not direct to the collector)
Browsers can't speak OTLP gRPC (the engine's transport), and we don't want the collector exposed to the
browser. So the studio exports OTLP/**HTTP** to a thin engine route, `POST /api/v1/telemetry/traces`,
which forwards the body **verbatim** to the collector (`INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT`, default
`http://localhost:4318/v1/traces`). Benefits: no collector CORS to configure (the browser only ever
calls the already-allowed engine origin), collector stays internal, and the proxy is encoding-agnostic
(protobuf or JSON pass through untouched). Export failures are swallowed (202) — telemetry must never
surface as a page error. The route is mounted only when telemetry is enabled and is excluded from
auto-instrumentation so it never traces itself.

**Transport gotcha:** the browser OTLP/HTTP exporter defaults to `navigator.sendBeacon`, but a
cross-origin `sendBeacon` POST with `Content-Type: application/json` can't satisfy the required CORS
preflight and is **dropped silently** — spans never arrive. We force the **XHR transport** by passing a
`headers` option to the exporter (the SDK selects XHR when `headers` is set). (The exporter's own POSTs to
the proxy are never traced — the API-client interceptor only traces requests made through `apiClient`, and
the exporter doesn't go through it.)

### D3. Cross-render context via an explicit ref (not ambient propagation)
The frontend pipeline spans several async React renders (run → response → repaint → layout → frame), so
the root span's OTel `Context` can't live on the call stack. It's held in a `ref` (and mirrored in a
module-level slot for the API client, see D1); each later stage opens its child against the stored
`interaction.ctx` **explicitly** (passed as `startSpan`'s third arg), never off `context.active()`. The
root closes on the first `requestAnimationFrame` after layout settles — making its duration the true
end-to-end latency.

We deliberately **do not** rely on a context manager to carry the active context across `await`s:
`ZoneContextManager` can't bridge native async/await (see D1), so every cross-async link — both the FE→BE
HTTP span and the later render stages — is wired with an explicit parent context instead. `provider.register`
still installs `ZoneContextManager`, but only as a valid *synchronous* context manager for the
`context.with` inside the per-stage `measureSync`; nothing depends on its async behaviour. (zone.js is now
effectively vestigial and could be dropped for `StackContextManager` in a later cleanup.)

### D4. Backend query spans live in the connector funnel
`BaseConnector.execute()` is the single async method every vendor (Cypher + Gremlin) passes through. The
two new spans wrap its two steps there, so **both query languages** get the DB-vs-serialize split in one
place — important because Gremlin isn't auto-instrumented the way SQLAlchemy is. Import is guarded so the
core package still imports without the optional `telemetry` extra (falls back to no-op spans).

### D5. Zero cost when disabled
Gated by `VITE_TELEMETRY_ENABLED`. When off, no provider registers, so the span helpers resolve to
OTel's no-op tracer and the Explorer instrumentation is free — mirroring RFC-007's
`INVANA_TELEMETRY_ENABLED` contract on the backend.

### D6. Lean attributes, no PII
Spans carry counts, language, mode, durations — **never query text or record contents**. Keeps payloads
small and avoids leaking graph data into the telemetry backend.

---

## Span catalog

| Span | Side | New? | Created in | Key attributes |
|---|---|---|---|---|
| `explorer.query.run` | FE | new | `handleRun` (ExplorerPage) — root | `explorer.mode`, `explorer.language` |
| `HTTP POST …/messages` | FE | new | API-client request interceptor (`startClientSpan`) | `http.request.method`, `url.full`, `http.response.status_code` |
| `POST …/messages` | BE | exists | `FastAPIInstrumentor` (RFC-007) | `http.route`, `http.status_code` |
| SQLAlchemy spans | BE | exists | `SQLAlchemyInstrumentor` (RFC-007) | SQL statement |
| `graph.query.db_execute` | BE | **new** | `BaseConnector.execute()` | — |
| `graph.query.serialize` | BE | **new** | `BaseConnector.execute()` | `invana.graph.node_count`, `edge_count` |
| `explorer.transform` | FE | new | `paintCanvas` (ExplorerPage) | `explorer.raw_nodes/raw_edges`, `node_count/edge_count` |
| `explorer.adapt` | FE | new | `graphData` memo (ExplorerPage) | `explorer.node_count/edge_count` |
| `explorer.layout` | FE | new | `AutoLayoutBridge` (ExplorerCanvas) | `explorer.node_count/edge_count` |
| `explorer.render` | FE | new | `AutoLayoutBridge` rAF (ExplorerCanvas) | — |

---

## Settings

**Engine** (`INVANA_*`, added to `settings.py`):

| Setting | Default | Description |
|---|---|---|
| `INVANA_TELEMETRY_OTLP_HTTP_ENDPOINT` | `http://localhost:4318/v1/traces` | Collector OTLP/HTTP endpoint the browser-span proxy forwards to |

(Existing `INVANA_TELEMETRY_ENABLED` also gates whether the proxy route is mounted.)

**Studio** (`VITE_*`, `.env`):

| Setting | Default | Description |
|---|---|---|
| `VITE_TELEMETRY_ENABLED` | `true` (on unless `"false"`) | Master switch for studio tracing |
| `VITE_API_BASE_URL` | `http://localhost:8200` | Existing — also the proxy + traceparent-propagation target |

---

## Wiring

**Engine** *(implemented):*
1. `settings.py` — add `telemetry_otlp_http_endpoint`.
2. `graph/connectors/base/connector.py` — `execute()` wraps `_execute_raw` and
   `deserialize_graph_response` in the two child spans (guarded OTel import).
3. `telemetry/routes.py` *(new)* — `POST /api/v1/telemetry/traces` proxy (httpx).
4. `server/app.py` — include `telemetry_router` when `telemetry_enabled`.
5. `telemetry/setup.py` — add `telemetry/traces` to `excluded_urls`.
6. `pyproject.toml` — add `httpx` to the `telemetry` extra.

**Studio:**
1. `package.json` — add `@opentelemetry/{api,sdk-trace-web,context-zone,resources,exporter-trace-otlp-http}`.
2. `services/telemetry/setup.ts` *(new)* — `WebTracerProvider` + `ZoneContextManager` + `BatchSpanProcessor` → OTLP/HTTP exporter (engine proxy URL); `provider.register` also installs the default W3C propagator used for injection. Behind `VITE_TELEMETRY_ENABLED`. (No auto-instrumentation — see D1.)
3. `services/telemetry/tracer.ts` *(new)* — `startInteraction` / `startChild` / `startClientSpan` / `measureSync` / `endInteraction` helpers + module-level active-interaction slot + `Interaction`/`InteractionRef` types.
4. `services/api/client.ts` — request interceptor opens the HTTP client span via `startClientSpan` and `propagation.inject`s `traceparent`; response/error interceptors end it (RFC-025 D1).
5. `main.tsx` — side-effect import of `./services/telemetry/setup` before `createRoot`.
6. `pages/graphs/explorer/ExplorerPage.tsx` — root span in `handleRun`; `transform` span in `paintCanvas`; `adapt` span in the `graphData` memo; pass the interaction ref to the canvas.
7. `pages/graphs/explorer/components/ExplorerCanvas.tsx` — `layout` + `render` spans in `AutoLayoutBridge`; closes the root (via `endInteraction`) after the first painted frame.
8. `.env.example` — add `VITE_TELEMETRY_ENABLED=true`.

---

## Dependencies (studio, OTel JS 2.x)

```
@opentelemetry/api                              (^1.9)
@opentelemetry/sdk-trace-web                     (^2.x)
@opentelemetry/context-zone                      (^2.x)   # sync context manager only (see D3)
@opentelemetry/resources                         (^2.x)
@opentelemetry/exporter-trace-otlp-http          (^0.2xx)
```

(The `@opentelemetry/instrumentation` + `instrumentation-xml-http-request` packages were dropped — the
FE→BE link is now explicit in the API client, see D1.)

Engine: `httpx` added to the `telemetry` optional extra.

---

## Verification

1. `docker compose -f docker-compose-infra.yml up -d` (HyperDX + collector).
2. Engine on :8200 with `INVANA_TELEMETRY_ENABLED=true`.
3. Studio on :8300 with `VITE_TELEMETRY_ENABLED=true`.
4. Run a Cypher query in the Explorer that returns nodes + edges.
5. Open HyperDX (`http://localhost:8080`) → find one trace with the full span tree above; confirm the
   backend spans nest under the frontend XHR span (propagation worked) and every stage shows a duration.
6. Set `VITE_TELEMETRY_ENABLED=false` → no spans emit; app unaffected.

---

## Non-Goals

- No whole-app auto-instrumentation (route loads, every API call) — Explorer query→render only.
- No Web Vitals (LCP/INP/CLS) this pass.
- No frontend **metrics** or **logs** — traces only (metrics/logs stay backend-side per RFC-007).
- No custom sampling — default always-on sampler (dev volume is low; revisit before prod).
- No direct browser→collector export — always via the engine proxy (D2).
