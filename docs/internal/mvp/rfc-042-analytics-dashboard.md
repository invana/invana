# RFC-042: Analytics dashboard — queries, messages & method performance

**Status**: Proposed
**Author**: Invana Team
**Date**: 2026-07-01
**Related**:
- **RFC-041** (query/message/LLM metrics) — the metric families this dashboard reads. `SessionMessage`
  already persists per-message stats (`llm_time_ms`, `execution_time_ms`, `row_count`, …); RFC-041 added
  the `invana.*` metric families. This RFC surfaces both to an operator.
- **RFC-024** (Query Sessions) — `SessionMessage` / `Session` are the rows the dashboard lists.
- **RFC-018** (Domain audit events) — the events module is the structural pattern the analytics module and
  Studio page mirror (graph-scoped router, keyset pagination, `require_graph_member`).
- **RFC-007** (Telemetry) — `@track` / `invana.method.duration` and the `MeterProvider`; this RFC attaches a
  second in-process metric reader and finally *applies* `@track`.
- **MVP** — analytics is **not** currently an MVP line item (the only observability entries are the
  cross-cutting `Telemetry` line and § 6.4 Agent observability). This RFC **adds a new MVP line** (see
  *MVP scope* below) rather than silently expanding scope (CLAUDE.md rule 5).

---

## Problem / intent

An operator has no in-product way to answer *"what are my users asking, how long did each take, and which
part of the engine is the bottleneck?"* The data exists but is unsurfaced:
- **User queries & messages + per-message stats** live in `SessionMessage` rows (content, mode, `via`,
  status, `source_query`, `llm_time_ms`, `execution_time_ms`, `row_count`, `node_count`, …) — never listed
  outside a single session thread.
- **Aggregate performance** (p95 latency, throughput) lives in the RFC-041 metric families, but only in an
  external OTLP backend (HyperDX/Grafana) — not everyone runs one.
- **Per-method timing** (`invana.method.duration`) *would* answer "top-5 slowest functions", but `@track`
  is applied to **nothing** today, so that metric is empty.

**Intent:** a **read-only Analytics page** in Studio, backed by a new engine `analytics/` module, that shows
(1) a paginated list of the graph's messages with their stats, (2) an aggregate summary, and (3) a **top-5
slowest engine methods** panel — all self-contained (no external metrics backend required).

**Scope this pass** (per the two decisions taken on 2026-07-01):
- **Studio page + engine analytics API**, reading the **app-state DB** for queries/messages/stats.
- **Instrument methods with `@track` first**, then rank the top-5 from real per-method timing.

---

## What you can see at the end

One graph-scoped page (`/u/{username}/{slug}/…/analytics`) with three regions:

```
┌ Analytics ───────────────────────────────────────────────┐
│ Messages 1,204 · NL 62% / QL 38% · errors 4%              │  ← summary (DB aggregates)
│ LLM  avg 610ms  p95 980ms   ·  Query  avg 140ms  p95 420ms│
│                                                           │
│ Slowest engine methods (top 5, since restart)  avg   p95  │  ← in-process metric reader
│  OpenCypherDataReader.read_neighbors           140  420   │    (invana.method.duration)
│  nl_to_query                                    98  310   │
│  BaseConnector.execute                          72  190   │
│  SessionStore.list_messages                     12   30   │
│  …                                                        │
│                                                           │
│ Messages                              mode  time   ok rows│  ← paginated SessionMessage list (DB)
│  "show me fraud rings between…"        nl   1.2s   ✓   42 │
│  MATCH (n:Account)-[…] RETURN n        ql   0.3s   ✓  100 │
│  "who owns account 8842?"              nl   0.9s   ✗    — │
└───────────────────────────────────────────────────────────┘
```

---

## Design decisions

### D1 — New engine `analytics/` module, graph-scoped, read-only

Mirror the events module (`events/routes.py`, `store.py`, `schemas.py`). Two endpoints under the
graph-scoped prefix `/api/v1/u/{username}/{graphSlug}/analytics`, both behind `require_graph_member` +
`resolve_graph_by_username_slug`:

- **`GET …/analytics/messages`** — keyset-paginated (cursor on `created_at DESC, id DESC`, `page_size`
  1–200, default 50) list of the graph's **assistant** messages joined to their preceding **user** message
  (the actual question). Each row returns: user text, `mode`, `via`, `status`, `query_language`,
  `source_query`, `llm_time_ms`, `execution_time_ms`, `row_count`, `node_count`, `edge_count`, `feedback`,
  `created_at`, `session_id`. Optional filters: `mode` (nl/ql), `status` (ok/error), `since`/`until`.
- **`GET …/analytics/summary`** — SQL aggregates over the graph's `SessionMessage` rows: total count, split
  by `mode` and `status`, and `avg` + approximate `p95` of `llm_time_ms` and `execution_time_ms`. Plus the
  **top-5 methods** block from D2. (`p95` via `percentile_cont` on Postgres; on SQLite dev we fall back to
  a bounded in-Python percentile over the row set — the dashboard labels it "≈".)

New module registered in `server/app.py` exactly like `events_router` / `graph_events_router`.

### D2 — Top-5 methods from an in-process metric reader (no external backend)

`@track` records `invana.method.duration` (a histogram, labels `class` / `method` / `status`) to the
`MeterProvider`. To read it **inside the engine** without standing up Prometheus, attach a **second metric
reader** in `telemetry/setup.py::_setup_metrics` alongside the existing OTLP `PeriodicExportingMetricReader`:

```python
otlp_reader = PeriodicExportingMetricReader(exporter, export_interval_millis=5_000)
memory_reader = InMemoryMetricReader()          # NEW — engine-local snapshot
provider = MeterProvider(resource=resource, metric_readers=[otlp_reader, memory_reader])
```

Expose `memory_reader` via a module-level accessor (`telemetry.get_in_memory_reader()`, set during setup).
The analytics service calls `reader.get_metrics_data()`, keeps the `invana.method.duration` histogram data
points, groups by `(class, method)`, and computes `count`, `avg = sum/count`, and `p95` (linear
interpolation over the histogram buckets). Returns the **top 5 ranked by total time consumed** (`sum` desc —
"where the wall-clock actually goes"), with avg/p95/count shown per row.

**Caveats (documented in the UI + docstring):**
- **Per-process.** With `uvicorn --workers N`, the endpoint sees only the worker that served it. Fine for
  single-worker dev; multi-worker prod should read the OTLP backend for a fleet-wide view. The panel is
  labelled *"this engine process"*.
- **Resets on restart** (cumulative since process start) — hence *"since restart"* in the header. The
  message list/summary (from the DB) are the durable, historical view; the method panel is live.

*Rejected alternative:* persist a timing row per method call to the DB — far too many writes on hot paths.
The in-process reader is the OTel-native, zero-write approach.

### D3 — Apply `@track`, safely, and let it wrap module-level functions

Two blockers found in the current `@track` (`telemetry/decorators/track.py`):

1. **`capture_args=True` by default** binds *every* argument to the span — including `encryption_key`,
   `api_key`, prompt text, and raw queries. **Decision:** apply `@track(capture_args=False)` everywhere in
   this pass. The `invana.method.duration` metric only uses `class`/`method`/`status` labels, so we lose
   nothing for the dashboard and leak nothing sensitive. (`capture_locals` stays `False`.)
2. **`@track` only wraps methods** — its wrapper hardcodes `self` (`type(self).__name__`). But the hot
   service layer here is **module-level functions** (`execute_query`, `nl_to_query`, `propose_model`).
   **Decision:** generalize the decorator: detect at decoration time whether the first parameter is `self`;
   if not, use a function-style wrapper that labels `class = "<module-tail>"` (e.g. `query_service`) and
   `method = func.__name__`. Method behaviour is unchanged.

**Instrumented set (focused, ~10 — CLAUDE.md rule 3: few, not exhaustive):**

| Layer | Target | Kind |
|---|---|---|
| Query service | `graphs/query_service.execute_query` | function |
| LLM | `llm/translate.nl_to_query`, `llm/propose.propose_model` | functions |
| Connector | `data_reader.read_vertices / read_edges / read_neighbors` (Cypher + Gremlin querysets) | methods |
| Store | `SessionStore.list_messages`, `EventStore.list_page` | methods |
| Manager | `GraphConnectionManager` connector-acquire | method |

Not instrumented: `send_message` and `BaseConnector.execute` / `execute_traversal` already have dedicated
spans + metrics from RFC-041 (`session.message`, `graph.query.*`) — adding `@track` would double-count them
in the top-5. The dashboard's per-message stats already reflect those two.

### D4 — Studio Analytics page (mirrors the Events feature)

- **Page:** `studio/src/pages/graphs/analytics/AnalyticsPage.tsx`, graph-scoped, reachable from the left
  rail (same place Messages/Model live). Route registered in `router.tsx` alongside the other graph-scoped
  pages.
- **API + hooks:** `services/api/analytics.ts` (axios `apiClient`) + `hooks/queries/useAnalytics.ts`
  (`useInfiniteQuery` for the message list, `useQuery` for the summary) — exact pattern of
  `services/api/events.ts` + `hooks/queries/useEvents.ts`.
- **Types:** `studio/src/types/analytics.ts`.
- **Components:** reuse `@invana/ui` (design-kit) only — `SearchInput`, `RichSelect` (mode/status filters),
  `Skeleton`, `Badge`, `Button`. No custom components, no charting lib this pass (top-5 is a simple
  ranked table; summary is stat tiles). A charts pass is a follow-up (Non-Goals).

---

## MVP scope

Analytics is not currently in `docs/internal/mvp.md`. This RFC **adds one cross-cutting line** under the
observability area:

> **Analytics dashboard — RFC-042** (queries/messages list + per-message stats + top-5 method timing;
> read-only, DB-backed, in-process method reader). Deferred: charts/timeseries, cross-graph/platform
> rollups, cross-worker aggregation (use the OTLP backend).

I'll add that line to `mvp.md` as part of implementation, not silently.

## Non-goals (this pass)

- **Charts / timeseries** (latency-over-time, sparklines) — ranked tables + stat tiles only.
- **Cross-worker / fleet aggregation** of the method panel — that's what the OTLP backend (HyperDX/Grafana)
  is for; the in-process reader is single-process by design.
- **Platform-wide (all graphs) analytics** — this pass is graph-scoped, mirroring events' graph variant.
- **Persisting method timings to the DB** — rejected (write volume). Method panel is live, not historical.
- **Cost/pricing** — out of scope (RFC-041 Non-Goal too).

## Files touched

| File | Change |
|---|---|
| `engine/src/invana/telemetry/decorators/track.py` | generalize to wrap plain functions; keep method path |
| `engine/src/invana/telemetry/setup.py` | attach `InMemoryMetricReader` as 2nd reader |
| `engine/src/invana/telemetry/__init__.py` | lazy `get_in_memory_reader()` accessor |
| `engine/src/invana/analytics/` | **new** — `routes.py`, `services.py`, `schemas.py`, `metrics_query.py` (reads the reader) |
| `engine/src/invana/server/app.py` | register the analytics router |
| ~8 call sites (D3 table) | add `@track(capture_args=False)` |
| `studio/src/pages/graphs/analytics/AnalyticsPage.tsx` | **new** page |
| `studio/src/services/api/analytics.ts`, `hooks/queries/useAnalytics.ts`, `types/analytics.ts` | **new** |
| `studio/src/router.tsx` + left-rail nav | register route + nav entry |
| `docs/internal/mvp.md` | add the Analytics line |
| `.changeset/*` | changeset (user-facing) |

## Testing (few, focused, real infra — no mocks)

- **Engine:** the analytics service ranks top-5 correctly from a real `InMemoryMetricReader` populated by a
  couple of `@track`-decorated dummy functions (positive); a decorated **function** (no `self`) records
  `invana.method.duration` with the module label (proves D3 generalization); the summary aggregates
  avg/p95 over a small set of seeded `SessionMessage` rows (uses the app-state DB fixture — **no graph DB**).
- **Studio:** one component/render test that the page lists messages and renders the top-5 table from a
  mocked API response (Testing Library) — API shape only, no network.

## Open questions for review

1. **Rank the top-5 by total time consumed (`sum`) or by `p95`?** RFC picks total time ("where wall-clock
   goes"); p95 is shown per row. Switchable in UI is a follow-up.
2. **Where in the left rail** should Analytics sit — next to Messages, or under the graph settings panel
   like the graph-scoped Events section? RFC picks the left rail (top-level, like Messages).
3. **`@track` set** — is the ~10-method list right, or do you want a specific method included/excluded?
