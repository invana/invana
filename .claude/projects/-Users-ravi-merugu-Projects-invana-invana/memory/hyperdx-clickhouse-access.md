---
name: hyperdx-clickhouse-access
description: How to query the local HyperDX/ClickHouse telemetry store to inspect engine errors/traces
metadata:
  type: reference
---

The user runs HyperDX-local (`invana-hyperdx` container, `telemetry` compose profile) as the OTel backend; engine ships traces/logs/metrics there via OTLP gRPC on `localhost:4317`. ClickHouse HTTP is on `localhost:8123`.

The bundled `default` ClickHouse user has a password baked into the image that we don't control. A repo-managed **read-only** user was added for host-side inspection:

- creds: `invana_ro` / `invana_ro` (readonly=2)
- config: `docker/clickhouse/users.d/invana-readonly.xml`, mounted into the hyperdx container via `docker-compose-infra.yml` (ClickHouse hot-reloads `users.d`).

Query errors like:
```
curl -s -u 'invana_ro:invana_ro' http://localhost:8123/ --data-binary "
SELECT Timestamp, ServiceName, SpanName, StatusCode, StatusMessage,
       SpanAttributes['http.route'] AS route, TraceId
FROM otel_traces
WHERE StatusCode='Error' AND Timestamp > now() - INTERVAL 6 HOUR
ORDER BY Timestamp DESC LIMIT 15 FORMAT Vertical"
```
Tables: `otel_traces`, `otel_logs`, `otel_metrics_*`. Join logs to a trace via `TraceId`. The engine's `TelemetryMiddleware` records exceptions on the request span with `invana.error.type` / `invana.error.message` attributes. Service names: `invana-engine`, `invana-studio`.
