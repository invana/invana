"""
All metric instrument definitions for Invana engine.

Histograms      → p50 / p95 / p99 latency
Counters        → total counts; apply rate() for per-second throughput
UpDownCounters  → live gauges (concurrency, connections)

Domains
-------
  api        invana.api.*                  HTTP requests via TelemetryMiddleware
  gremlin    invana.query.gremlin.*        Graph query execution
  postgres   invana.query.postgres.*       App-state DB queries
  ontology   invana.ontology.operation.*   Modeller / schema operations
  method     invana.method.*               Generic method-level instrumentation
  system     invana.system.*               Connection pool / span gauges
"""

from opentelemetry import metrics

meter = metrics.get_meter("invana.core")

# ── API — latency & volume ────────────────────────────────────────────────────

api_request_duration = meter.create_histogram(
    name="invana.api.request.duration",
    description="End-to-end API request latency",
    unit="ms",
)

api_request_size = meter.create_histogram(
    name="invana.api.request.size",
    description="Incoming request body size",
    unit="bytes",
)

api_response_size = meter.create_histogram(
    name="invana.api.response.size",
    description="Outgoing response body size",
    unit="bytes",
)

api_request_count = meter.create_counter(
    name="invana.api.request.count",
    description="Total API requests received",
)

api_error_count = meter.create_counter(
    name="invana.api.error.count",
    description="Total API errors (4xx + 5xx)",
)

# ── API — concurrency & throughput ────────────────────────────────────────────

api_requests_in_flight = meter.create_up_down_counter(
    name="invana.api.requests_in_flight",
    description="Requests currently being processed",
)

api_throughput_requests = meter.create_counter(
    name="invana.api.throughput.requests",
    description="Completed requests — rate() gives req/sec",
)

api_throughput_bytes = meter.create_counter(
    name="invana.api.throughput.bytes",
    description="Response bytes sent — rate() gives bytes/sec",
    unit="bytes",
)

# ── API — status-code buckets ─────────────────────────────────────────────────

api_status_2xx = meter.create_counter(
    name="invana.api.status.2xx",
    description="Total 2xx responses",
)

api_status_4xx = meter.create_counter(
    name="invana.api.status.4xx",
    description="Total 4xx responses",
)

api_status_5xx = meter.create_counter(
    name="invana.api.status.5xx",
    description="Total 5xx responses",
)

# ── Gremlin ───────────────────────────────────────────────────────────────────

gremlin_query_duration = meter.create_histogram(
    name="invana.query.gremlin.duration",
    description="Gremlin query execution duration",
    unit="ms",
)

gremlin_query_count = meter.create_counter(
    name="invana.query.gremlin.count",
    description="Total Gremlin queries executed",
)

gremlin_error_count = meter.create_counter(
    name="invana.query.gremlin.errors",
    description="Total Gremlin query errors",
)

gremlin_result_size = meter.create_histogram(
    name="invana.query.gremlin.result_size",
    description="Gremlin query result row count",
    unit="rows",
)

gremlin_queries_in_flight = meter.create_up_down_counter(
    name="invana.query.gremlin.in_flight",
    description="Gremlin queries currently executing",
)

# ── Postgres ──────────────────────────────────────────────────────────────────

postgres_query_duration = meter.create_histogram(
    name="invana.query.postgres.duration",
    description="Postgres query execution duration",
    unit="ms",
)

postgres_query_count = meter.create_counter(
    name="invana.query.postgres.count",
    description="Total Postgres queries executed",
)

postgres_error_count = meter.create_counter(
    name="invana.query.postgres.errors",
    description="Total Postgres query errors",
)

postgres_queries_in_flight = meter.create_up_down_counter(
    name="invana.query.postgres.in_flight",
    description="Postgres queries currently executing",
)

# ── Ontology / Modeller ───────────────────────────────────────────────────────

ontology_operation_duration = meter.create_histogram(
    name="invana.ontology.operation.duration",
    description="Modeller / ontology operation duration",
    unit="ms",
)

ontology_operation_count = meter.create_counter(
    name="invana.ontology.operation.count",
    description="Total modeller operations executed",
)

ontology_error_count = meter.create_counter(
    name="invana.ontology.operation.errors",
    description="Total modeller operation errors",
)

ontology_operations_in_flight = meter.create_up_down_counter(
    name="invana.ontology.operation.in_flight",
    description="Modeller operations currently executing",
)

# ── Method (generic) ─────────────────────────────────────────────────────────

method_duration = meter.create_histogram(
    name="invana.method.duration",
    description="Manager / service method execution duration",
    unit="ms",
)

method_error_count = meter.create_counter(
    name="invana.method.errors",
    description="Total method execution errors by class and error type",
)

method_calls_in_flight = meter.create_up_down_counter(
    name="invana.method.in_flight",
    description="Methods currently executing",
)

# ── System ────────────────────────────────────────────────────────────────────

active_connections = meter.create_up_down_counter(
    name="invana.system.active_connections",
    description="Active database connections (postgres + graph)",
)

active_spans = meter.create_up_down_counter(
    name="invana.system.active_spans",
    description="Currently in-flight OTel spans",
)
