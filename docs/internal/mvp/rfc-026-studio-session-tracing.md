# RFC-026: Session/message tracing + FE→BE trace stitching fix

**Status**: Proposed
**Author**: Invana Team
**Date**: 2026-06-13
**Related**:
- **RFC-025** (Studio Telemetry — query→render tracing) — this RFC extends RFC-025's Explorer-only
  scope and fixes two bugs discovered in the shipped RFC-025 code (FE→BE stitching never worked; the
  Explorer interaction lifecycle leaks across runs). RFC-025 stays the baseline; its non-goal *"no
  whole-app auto-instrumentation"* is narrowed — see Scope.
- **RFC-024** (Query Sessions) — the session/message endpoints this RFC instruments.
- **RFC-007** (Telemetry — engine OTel stack) — the engine `TelemetryMiddleware` fixed here lives in
  this stack.

---

## Problem / intent

RFC-025 traces one path: a *fresh* Explorer query typed into the editor and submitted via **Run**.
Everything else a user does with sessions/messages is dark, and — discovered while verifying RFC-025 —
the cross-service stitching it promised never actually worked. Concretely:

1. **Re-running a query by clicking a message** (`handleRerun`) and **opening a session**
   (auto-restore `useEffect`) re-run the query and repaint the canvas, but open **no interaction** —
   untraced.
2. **Standalone session/message API ops** (list, create, pin, archive, delete) emit no spans — the API
   client only traces while an Explorer run is in flight.
3. **FE→BE stitching is broken.** Engine request spans arrive as `INTERNAL` + `ROOT`; the browser's
   `traceparent` is never adopted, so frontend and backend are two unrelated traces. Verified: sending
   `traceparent: 00-aaaabbbb…-…-01` to the engine produced a span under a *different* trace id.
4. **Interaction lifecycle leaks.** Multiple runs collapse under one `explorer.query.run` root because
   the root isn't reliably closed/reset outside the happy path.

**Intent:** trace every session/message interaction end-to-end as **one distributed trace** per action,
and fix the two latent RFC-025 bugs so those traces are actually stitched and correctly separated.

---

## Root cause — why stitching never worked (engine)

Two independent defects in the engine, both in the RFC-007 telemetry stack:

- **`TelemetryMiddleware` ignores the incoming context.** `telemetry/middleware.py` opens the request
  span with `tracer.start_as_current_span(span_name)` — default `kind=INTERNAL`, parent = the (empty)
  ambient context. It never calls `propagate.extract()` on the request headers, so it can't become a
  child of the browser's client span.
- **`FastAPIInstrumentor.instrument_app()` is called too late.** It runs inside `lifespan` (startup),
  after Starlette has already built its middleware stack, so the auto-instrumentation never wraps
  requests. This is why the engine has **zero `SERVER` spans, ever** — FastAPI instrumentation is a
  no-op and the custom middleware is the sole request-span source.

RFC-025 D1 assumed `FastAPIInstrumentor` would extract `traceparent` automatically. It can't here:
it isn't running, and the middleware that *is* running doesn't propagate.

---

## Design decisions

### D1. Engine: `TelemetryMiddleware` extracts context and emits a `SERVER` span
Extract the W3C context from the request headers and open the span against it, as a `SERVER` span:

```python
from opentelemetry.propagate import extract
from opentelemetry.trace import SpanKind

ctx = extract(dict(request.headers))
with tracer.start_as_current_span(span_name, context=ctx, kind=SpanKind.SERVER) as span:
    ...
```

This makes every engine request a child of the caller's span when a `traceparent` is present (browser
Explorer runs) and a clean `SERVER` root otherwise (curl, health probes, server-to-server). Fixes
stitching for *all* requests, not just the Explorer path — so D3's session/message ops are end-to-end
for free. The custom middleware stays the single request-span source; the dead `instrument_app()` call
is left as-is for now (it's a harmless no-op) but flagged for cleanup so a future "fix" that moves it to
`create_app()` doesn't double-instrument against this middleware.

### D2. Frontend: all query→render triggers open an interaction
`run`, `rerun`, and `restore` each open an interaction via one shared helper (`runInteraction`), so the
existing `transform`/`adapt`/`layout`/`render` child spans attach automatically. Each carries
`explorer.trigger` = `run | rerun | restore`. This also **fixes the lifecycle leak** (D4): the helper
opens exactly one root and the canvas closes exactly one root per trigger; a new trigger ends any
still-open interaction first, so runs never merge.

### D3. Frontend: session/message API ops traced at the client
Relax the API-client interceptor: for any request whose URL matches `…/sessions…` or `…/messages…`,
emit an HTTP **client** span even when no Explorer run is in flight (its own root trace), and
`propagation.inject` `traceparent`. With D1 in place each becomes one distributed trace
(browser client span → engine `SERVER` span → SQLAlchemy). Non-session/message routes stay untraced —
this is the narrowing of RFC-025's "not whole-app" line, not its removal.

### D4. Frontend: deterministic interaction lifecycle
The active-interaction module slot and `runRef` are cleared on `endInteraction`, and any new trigger
ends a still-open interaction before starting its own. One trigger = one root = one trace.

### D5. Lean attributes, no PII (inherited from RFC-025 D6)
Counts, `explorer.trigger`, HTTP method/route/status, durations — never query text or record contents.

---

## Span catalog (new / changed)

| Span | Side | Change | Notes |
|---|---|---|---|
| `{METHOD} {route}` (engine request) | BE | **fixed** | now `SERVER` kind + extracts `traceparent` |
| `explorer.query.run` | FE | changed | now also opened for rerun/restore; `explorer.trigger` attr |
| `HTTP {METHOD}` (session/message ops) | FE | new | emitted for `…/sessions…` / `…/messages…` outside a run |

---

## Scope

- **In:** Explorer run/rerun/restore tracing; session/message API-op tracing; engine context-extraction
  fix; interaction-lifecycle fix.
- **Out (still):** tracing non-session/message app routes (graphs list, llm providers, modeller, …);
  Web Vitals; frontend metrics/logs; custom sampling. RFC-025's other non-goals stand.

---

## Verification

1. Run a fresh Explorer query → one trace, `explorer.trigger=run`, **engine spans nested under the
   browser HTTP span** (stitching), `graph.query.*` visible.
2. Click an existing message → trace with `explorer.trigger=rerun`, fully stitched.
3. Open a session → trace with `explorer.trigger=restore`.
4. Pin/archive/delete a session → a standalone distributed trace per op.
5. Two consecutive runs → **two separate** `explorer.query.run` traces (no merge).
6. `VITE_TELEMETRY_ENABLED=false` / `INVANA_TELEMETRY_ENABLED=false` → no spans; app unaffected.
