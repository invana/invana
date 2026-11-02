# Telemetry

System design: [observability.md](../../../../../specs/system-design/observability.md) — traces, metrics, logs, attributes, Studio, transport, dashboards, seams, decisions and what is not built. This file keeps a plan row and a test row.

## Stayed

| Thing | Shape |
|---|---|
| Studio action span to come | `ui.boards.open` lands with the Boards view panel |
| Tests | Vitest in Node (`pnpm test`), spans captured by an in-memory exporter |
