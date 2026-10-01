"""
Every metric instrument the engine records, in one place.

Names follow the modules — ``invana.<module>.*`` — and, for HTTP, the
OpenTelemetry semantic conventions (``http.server.*``). Durations are
histograms in **seconds**, as the conventions say; counts are counters; what is
in flight right now is an up-down counter; the connection pool is an observable
gauge read when the exporter collects.

Instruments
-----------
  http.server.request.duration        histogram    http.request.method · http.route · http.response.status_code
  http.server.active_requests         up-down      http.request.method · http.route
  invana.runs.duration                histogram    kind · role · outcome · triggered_by
  invana.runs.queue_wait              histogram    kind · role · triggered_by
  invana.runs.count                   counter      kind · role · outcome · triggered_by
  invana.runs.active                  up-down      kind · role · triggered_by
  invana.runs.step.duration           histogram    step_key · outcome
  invana.llms.request.duration        histogram    provider · model · role · outcome
  invana.llms.request.count           counter      provider · model · role · outcome
  invana.llms.tokens                  counter      provider · model · direction (input · output)
  invana.llms.cost                    counter      provider · model
  invana.graph_connectors.query.*     histogram · counter    connector · language · operation · outcome
  invana.assistant.streams.active     up-down      stream (run · events)
  invana.events.emitted               counter      action
  invana.system.loop.duration         histogram    loop
  invana.system.loop.failures         counter      loop
  invana.graphs.pool.connections      observable gauge       state (healthy · backoff · down)

Attributes are bounded
----------------------
A metric attribute takes a handful of values, never an id: no user id, run id
or Graph id ever lands here — those are on spans and logs, where one action is
the unit. A histogram point still leads to a trace: the meter provider keeps
**exemplars** from sampled spans (see ``setup.py``), so a slow bucket opens one
of the requests that filled it.

Recording
---------
Code inside ``core/telemetry`` (the HTTP middleware) records on these
instruments directly. Everything else goes through ``recorders.py``, whose
functions are no-ops when the optional ``telemetry`` extra is absent — so a
connector, the LLM client or the runtime never imports OpenTelemetry itself.
The recorders read each instrument off this module at call time, which is also
what lets a test point one at a local ``MeterProvider``.
"""

from opentelemetry import metrics

meter = metrics.get_meter("invana.engine")

# ── HTTP (semantic conventions) ──────────────────────────────────────────────

http_server_duration = meter.create_histogram(
    name="http.server.request.duration",
    description="Duration of HTTP server requests",
    unit="s",
)
http_server_active = meter.create_up_down_counter(
    name="http.server.active_requests",
    description="HTTP server requests in flight",
    unit="{request}",
)

# ── Runs ─────────────────────────────────────────────────────────────────────

runs_duration = meter.create_histogram(
    name="invana.runs.duration",
    description="A run's working time, from admitted to settled",
    unit="s",
)
runs_queue_wait = meter.create_histogram(
    name="invana.runs.queue_wait",
    description="Time a run waited for a slot before it was admitted",
    unit="s",
)
runs_count = meter.create_counter(
    name="invana.runs.count",
    description="Runs settled, by outcome",
    unit="{run}",
)
runs_active = meter.create_up_down_counter(
    name="invana.runs.active",
    description="Runs being worked right now",
    unit="{run}",
)
runs_step_duration = meter.create_histogram(
    name="invana.runs.step.duration",
    description="One attempt of one step",
    unit="s",
)

# ── LLMs ─────────────────────────────────────────────────────────────────────

llms_request_duration = meter.create_histogram(
    name="invana.llms.request.duration",
    description="One model provider call",
    unit="s",
)
llms_request_count = meter.create_counter(
    name="invana.llms.request.count",
    description="Model provider calls, by outcome",
    unit="{request}",
)
llms_tokens = meter.create_counter(
    name="invana.llms.tokens",
    description="Tokens sent and received",
    unit="{token}",
)
llms_cost = meter.create_counter(
    name="invana.llms.cost",
    description="Spend on model calls that have a price",
    unit="USD",
)

# ── Graph connectors (Cypher and Gremlin alike) ──────────────────────────────

graph_query_duration = meter.create_histogram(
    name="invana.graph_connectors.query.duration",
    description="One graph query round-trip",
    unit="s",
)
graph_query_count = meter.create_counter(
    name="invana.graph_connectors.query.count",
    description="Graph queries, by outcome",
    unit="{query}",
)
graph_query_result_size = meter.create_histogram(
    name="invana.graph_connectors.query.result_size",
    description="Rows or elements a successful graph query returned",
    unit="{row}",
)

# ── Assistant streams ────────────────────────────────────────────────────────

assistant_streams_active = meter.create_up_down_counter(
    name="invana.assistant.streams.active",
    description="Server-sent event streams open right now",
    unit="{stream}",
)

# ── Events ───────────────────────────────────────────────────────────────────

events_emitted = meter.create_counter(
    name="invana.events.emitted",
    description="Audit events written, by action",
    unit="{event}",
)

# ── System loops ─────────────────────────────────────────────────────────────

system_loop_duration = meter.create_histogram(
    name="invana.system.loop.duration",
    description="One iteration of a background loop",
    unit="s",
)
system_loop_failures = meter.create_counter(
    name="invana.system.loop.failures",
    description="Background loop iterations that failed",
    unit="{iteration}",
)

# ── Graph connection pool ────────────────────────────────────────────────────
# The gauge is observable: ``recorders.observe_pool`` registers the callback
# that reads the pool when the exporter collects.

POOL_CONNECTIONS = "invana.graphs.pool.connections"
