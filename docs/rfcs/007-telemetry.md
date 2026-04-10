# RFC-007: Telemetry (Traces, Metrics, Logs)

**Status**: Accepted  
**Author**: Invana Team  
**Date**: 2026-04-10

---

## Problem

The engine has no observability. There is no way to trace slow queries, measure per-endpoint latency, track error rates, or correlate log messages to their originating request span. This makes production debugging and performance tuning very difficult.

---

## Goals

1. Distributed traces for every HTTP request and every internal method call.
2. Metrics: latency histograms, request/error counters, in-flight gauges — covering API, Gremlin queries, Postgres operations, and modeller operations.
3. Structured logs with `trace_id` / `span_id` injected into every record so logs link directly to their trace in the backend.
4. Wire seamlessly into any OTel-compatible backend (HyperDX, Signoz, Jaeger, Prometheus, etc.) via OTLP gRPC.
5. Zero overhead when disabled (`INVANA_TELEMETRY_ENABLED=false`).
6. No changes to existing business logic — instrumentation is opt-in via decorator.

---

## Design Decisions

### Signal transport: OTLP gRPC
- Single protocol, all three signals (traces / metrics / logs).
- Compatible with all major OTel backends.
- Configured via `INVANA_TELEMETRY_OTLP_ENDPOINT` (default `http://localhost:4317`).

### Middleware: pure ASGI (not `BaseHTTPMiddleware`)
`BaseHTTPMiddleware` wraps `call_next` in a new `asyncio.Task`, which forks the contextvars context. Any child span created inside a route handler would be orphaned from the parent HTTP span. A raw ASGI `__call__` keeps the same task context throughout, so `@track()` spans nest correctly.

### Three-layer instrumentation

| Layer | Mechanism | What it covers |
|---|---|---|
| HTTP | `TelemetryMiddleware` (ASGI) + `FastAPIInstrumentor` | All routes, latency, status codes |
| DB | `SQLAlchemyInstrumentor(enable_commenter=True)` | All app-state Postgres queries |
| Business logic | `@track()` + `@capture_metrics()` decorators | Manager/service methods |

### Decorators: `@track()` and `@capture_metrics()`
- `@track()` wraps any async/sync method in an OTel span. Options: `capture_args`, `capture_result`, `capture_locals` (frame-by-frame local dump on failure), `span_name`.
- `@capture_metrics(domain, operation, resource, backend)` records domain-specific histograms, counters, and in-flight gauges without any tracing.
- Stack with `@track()` on the outside so the span is the parent.

### Metric domains

| Domain | Metric prefix | Covers |
|---|---|---|
| `api` | `invana.api.*` | HTTP requests via middleware |
| `gremlin` | `invana.query.gremlin.*` | Graph queries |
| `postgres` | `invana.query.postgres.*` | App-state DB queries |
| `ontology` | `invana.ontology.operation.*` | Modeller operations |
| `method` | `invana.method.*` | Generic method calls |

### Logging integration
`LoggingInstrumentor(set_logging_format=True)` modifies the Python root logger format to include `trace_id` and `span_id`. Every log record emitted during a traced operation automatically carries the span context. Log records are also shipped to the OTel collector via `OTLPLogExporter` + `BatchLogRecordProcessor`.

### Idempotent bootstrap
`setup_telemetry()` is guarded by a `_providers_initialised` flag — safe to call multiple times from different entry points (server, CLI, tests).

---

## Module Structure

```
engine/src/invana/telemetry/
├── __init__.py          # re-exports setup_telemetry, instrument_app, TelemetryMiddleware
├── setup.py             # provider bootstrap, instrument_app()
├── metrics.py           # all OTel metric instrument definitions
├── middleware.py        # TelemetryMiddleware (pure ASGI)
└── decorators/
    ├── __init__.py      # re-exports track, capture_metrics
    ├── track.py         # @track() span decorator
    └── capture_metrics.py  # @capture_metrics() metrics decorator
```

---

## Settings (via `INVANA_*` env vars)

| Setting | Default | Description |
|---|---|---|
| `INVANA_TELEMETRY_ENABLED` | `false` | Master switch |
| `INVANA_TELEMETRY_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC collector |
| `INVANA_TELEMETRY_SERVICE_NAME` | `invana-engine` | Service name in traces |
| `INVANA_TELEMETRY_ENVIRONMENT` | `development` | `deployment.environment` label |

---

## Wiring

1. `settings.py` — add four telemetry settings.
2. `pyproject.toml` — add OTel packages under `[project.optional-dependencies] telemetry`.
3. `server/app.py` lifespan — call `setup_telemetry()` if enabled, then `instrument_app(app, engine)`.
4. `server/app.py` — add `TelemetryMiddleware` to the app (before all routes, after lifespan setup).

---

## Dependencies (optional group `telemetry`)

```
opentelemetry-api
opentelemetry-sdk
opentelemetry-exporter-otlp-proto-grpc
opentelemetry-instrumentation-fastapi
opentelemetry-instrumentation-sqlalchemy
opentelemetry-instrumentation-logging
```

---

## Non-Goals

- No Prometheus scrape endpoint (use OTel Collector → Prometheus pipeline instead).
- No custom sampling rules in this RFC (uses default parent-based sampler).
- No frontend (Studio) tracing in this RFC.
