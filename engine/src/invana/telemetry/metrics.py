"""
All metric instrument definitions for Invana engine.

Histograms      → p50 / p95 / p99 latency
Counters        → total counts; apply rate() for per-second throughput
UpDownCounters  → live gauges (concurrency, connections)

Domains
-------
  api        invana.api.*                  HTTP requests via TelemetryMiddleware
  llm        invana.llm.*                  LLM provider calls (RFC-041)
  graph      invana.query.graph.*          Graph query execution, both languages (RFC-041)
  message    invana.session.message.*      Session message round-trips (RFC-041)
  gremlin    invana.query.gremlin.*        LEGACY — superseded by invana.query.graph.* (RFC-041)
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

# ── LLM (RFC-041) — provider-call latency & token throughput ──────────────────
# Labels: provider, model_id, operation (translate/propose), status, error_type.
# Emitted inline from invana.llm.client (module-level functions can't take the
# @capture_metrics decorator, which assumes a bound ``self``).

llm_request_duration = meter.create_histogram(
    name="invana.llm.request.duration",
    description="LLM provider-call latency (per _invoke, incl. any corrective retry as a 2nd sample)",
    unit="ms",
)

llm_request_count = meter.create_counter(
    name="invana.llm.request.count",
    description="Total LLM provider calls",
)

llm_request_errors = meter.create_counter(
    name="invana.llm.request.errors",
    description="Total failed LLM provider calls",
)

llm_requests_in_flight = meter.create_up_down_counter(
    name="invana.llm.requests_in_flight",
    description="LLM provider calls currently executing",
)

llm_tokens_input = meter.create_counter(
    name="invana.llm.tokens.input",
    description="Input tokens sent to the provider — rate() gives tokens/sec",
    unit="tokens",
)

llm_tokens_output = meter.create_counter(
    name="invana.llm.tokens.output",
    description="Output tokens returned by the provider — rate() gives tokens/sec",
    unit="tokens",
)

# ── Graph query (RFC-041) — unified across Cypher + Gremlin ────────────────────
# Labels: language (cypher/gremlin), backend (connector class), status, error_type,
# error_category. Emitted inline from the connector round-trip points.

graph_query_duration = meter.create_histogram(
    name="invana.query.graph.duration",
    description="Graph query driver round-trip duration (both languages)",
    unit="ms",
)

graph_query_count = meter.create_counter(
    name="invana.query.graph.count",
    description="Total graph queries executed",
)

graph_query_errors = meter.create_counter(
    name="invana.query.graph.errors",
    description="Total graph query errors",
)

graph_query_result_size = meter.create_histogram(
    name="invana.query.graph.result_size",
    description="Graph query result element count (nodes + edges, or traversal rows)",
    unit="rows",
)

graph_queries_in_flight = meter.create_up_down_counter(
    name="invana.query.graph.in_flight",
    description="Graph queries currently executing",
)

# ── Session message (RFC-041) — end-to-end message round-trips ────────────────
# Labels: mode (nl/ql), surface (explorer/modeller), status (ok/error/clarify).

session_message_duration = meter.create_histogram(
    name="invana.session.message.duration",
    description="End-to-end session message latency (translate + query)",
    unit="ms",
)

session_message_count = meter.create_counter(
    name="invana.session.message.count",
    description="Total session messages processed",
)

session_message_errors = meter.create_counter(
    name="invana.session.message.errors",
    description="Total session messages that ended in error",
)

session_messages_in_flight = meter.create_up_down_counter(
    name="invana.session.message.in_flight",
    description="Session messages currently being processed",
)

# ── Gremlin — LEGACY (RFC-041) ────────────────────────────────────────────────
# Superseded by the unified invana.query.graph.* family above for the connector
# path. Kept defined so the @capture_metrics(domain="gremlin") contract still
# resolves; currently emitted by nothing.

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
