"""
Telemetry bootstrap.

Public entry points:

  setup_telemetry()     — Registers OTel providers (traces, metrics, logs) and instruments
                          outgoing HTTP. Idempotent — safe to call multiple times;
                          initialises once. Called when ``invana`` is imported with
                          INVANA_TELEMETRY_ENABLED=true, by the server and the CLI alike.

  instrument_app()      — Adds SQLAlchemy auto-instrumentation to the server's engine.
                          Call once inside the FastAPI lifespan after the DB engine exists.

  instrument_process()  — Adds SQLAlchemy auto-instrumentation to every engine created
                          afterwards, for a process with no FastAPI lifespan (the CLI).
                          Idempotent.

  flush_telemetry()     — Exports whatever the providers still hold, within a time budget.
                          A short-lived process (a CLI command) calls it before exiting so
                          its spans are not lost with the batch processor's queue.

Instruments:
  - HTTP requests    (TelemetryMiddleware — the only source of request spans; it is
                      added when the app is built, because instrumentation applied
                      from the lifespan runs after Starlette has already built its
                      middleware stack and never takes effect)
  - SQLAlchemy       (all app-state DB queries, trace context injected into SQL comments)
  - Outgoing HTTP    (every httpx client call — a model provider, a connector's REST
                      API — is a client span under the span that made it; the browser
                      telemetry proxy suppresses it for its own forward)
  - Python logging   (every record shipped over OTLP carries its span context; the
                      console format gets trace ids from the logging filters)
  - Metrics          (the catalogue in metrics.py, recorded by the middleware and,
                      everywhere else, through the no-op-safe recorders.py; every
                      histogram point keeps exemplars from sampled spans, so a
                      slow bucket links to a trace that filled it)

Sampling:
  Traces are sampled by trace id at ``sample_ratio`` for new root traces; a request
  that arrives with a parent (e.g. the studio's ``traceparent``) follows the
  parent's decision, so a distributed trace is kept or dropped as a whole.

Signals exported via OTLP gRPC to any OTel-compatible backend (HyperDX, Signoz, etc.).
"""

from __future__ import annotations

import logging
import threading
import time

from opentelemetry import metrics, trace
from opentelemetry._logs import get_logger_provider, set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider, TraceBasedExemplarFilter
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ParentBased, Sampler, TraceIdRatioBased

logger = logging.getLogger("invana.telemetry")

_providers_initialised = False


def setup_telemetry(
    service_name: str = "invana-engine",
    service_version: str = "0.0.0",
    otlp_endpoint: str = "http://localhost:4317",
    environment: str = "development",
    sample_ratio: float = 1.0,
) -> None:
    """
    Register OTel trace / metric / log providers.

    Idempotent — safe to call multiple times; only initialises once.

    Parameters
    ----------
    service_name:    Identifies this service in the OTel backend.
    service_version: Shown in service details.
    otlp_endpoint:   gRPC endpoint of the OTel collector (default: 4317).
    environment:     deployment.environment label (development / staging / production).
    sample_ratio:    Fraction of new root traces to keep, 0.0 to 1.0 (default 1.0 = all).
                     Traces started elsewhere follow their parent's sampling decision.
    """
    global _providers_initialised
    if _providers_initialised:
        return

    resource = Resource.create(
        {
            SERVICE_NAME: service_name,
            SERVICE_VERSION: service_version,
            "deployment.environment": environment,
            "invana.component": "engine",
            "invana.telemetry.sample_ratio": sample_ratio,
        }
    )

    _setup_traces(resource, otlp_endpoint, sample_ratio)
    _setup_metrics(resource, otlp_endpoint)
    _setup_logs(resource, otlp_endpoint)
    HTTPXClientInstrumentor().instrument()

    _providers_initialised = True
    logger.info(
        "Telemetry initialised → %s  service=%s  env=%s  sample_ratio=%s",
        otlp_endpoint,
        service_name,
        environment,
        sample_ratio,
    )


def instrument_app(app, engine) -> None:
    """
    Add SQLAlchemy auto-instrumentation to the app-state database engine.

    Call this once inside the FastAPI lifespan after the DB engine is ready.
    Requires setup_telemetry() to have been called first.

    HTTP requests are not instrumented here: TelemetryMiddleware, added when the
    app is built, is the only source of request spans. Instrumentation applied
    from the lifespan would come after Starlette has built its middleware stack
    and never take effect.

    Parameters
    ----------
    app:    The FastAPI application instance (kept for the call site; unused).
    engine: The SQLAlchemy async engine (from create_db_engine()).
    """
    SQLAlchemyInstrumentor().instrument(
        engine=engine.sync_engine,
        enable_commenter=True,  # injects trace-context into SQL comments
    )


def instrument_process() -> None:
    """
    Add SQLAlchemy auto-instrumentation to every engine this process creates from now on.

    For a process with no FastAPI lifespan to hand an engine to ``instrument_app()`` —
    the CLI, whose commands each create their own engine. Called with no engine, the
    instrumentor wraps ``create_engine`` and ``create_async_engine`` at their modules,
    so an engine is traced when it is created through a module-attribute lookup made
    after this call (``invana.core.db`` looks them up that way for this reason), and
    ``Engine.connect`` on every engine gets a ``connect`` span. Statements carry the
    trace context in SQL comments, as on the server.

    Idempotent — the instrumentor is a process-wide singleton and a second call is a
    no-op. Requires setup_telemetry() to have been called first. Never call it in the
    server process: it would claim the singleton and turn ``instrument_app()`` into a
    no-op.
    """
    instrumentor = SQLAlchemyInstrumentor()
    if instrumentor.is_instrumented_by_opentelemetry:
        return
    instrumentor.instrument(enable_commenter=True)


def flush_telemetry(timeout_millis: int = 5000) -> None:
    """
    Export whatever the trace, metric and log providers still hold.

    Batch processors export on a timer; a process that exits first — a CLI command
    that ran for a second — would lose its spans. Call this once the work is done
    and its spans have ended.

    ``timeout_millis`` is the budget for all three providers together, so an
    unreachable collector delays the caller by at most that long: the exporters
    retry past the timeout they are handed, so the flush runs on a daemon thread
    and is abandoned when the budget runs out. Providers that are
    not the SDK's (telemetry never set up) are skipped. Never raises: a flush that
    fails is logged at debug and the process carries on.

    Parameters
    ----------
    timeout_millis: Total time to wait for the exports, in milliseconds.
    """
    providers = [
        p
        for p in (trace.get_tracer_provider(), metrics.get_meter_provider(), get_logger_provider())
        if isinstance(p, (TracerProvider, MeterProvider, LoggerProvider))
    ]
    if not providers:
        return
    deadline = time.monotonic() + timeout_millis / 1000

    def _flush_all() -> None:
        for provider in providers:
            remaining = int((deadline - time.monotonic()) * 1000)
            if remaining <= 0:
                return
            try:
                provider.force_flush(timeout_millis=remaining)
            except Exception as exc:  # telemetry never breaks the caller
                logger.debug("Telemetry flush failed for %s — %s", type(provider).__name__, exc)

    # The exporters' retries do not honour the timeout they are given, so the
    # flush runs on a daemon thread and the caller waits for the budget at most.
    worker = threading.Thread(target=_flush_all, name="invana-telemetry-flush", daemon=True)
    worker.start()
    worker.join(timeout=max(deadline - time.monotonic(), 0))
    if worker.is_alive():
        logger.debug("Telemetry flush still running after %sms — not waiting", timeout_millis)


# ── internals ─────────────────────────────────────────────────────────────────


def _sampler(ratio: float) -> Sampler:
    """Build the trace sampler for a given keep ratio.

    New root traces are kept with probability ``ratio``, decided from the trace id
    so every service reaches the same verdict. A span with a parent — local, or
    remote via ``traceparent`` — inherits the parent's decision, so a trace is
    never cut in half.
    """
    return ParentBased(TraceIdRatioBased(ratio))


def _setup_traces(resource: Resource, endpoint: str, sample_ratio: float) -> None:
    exporter = OTLPSpanExporter(endpoint=endpoint)
    provider = TracerProvider(resource=resource, sampler=_sampler(sample_ratio))
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


def _setup_metrics(resource: Resource, endpoint: str) -> None:
    """Export metrics every five seconds, with exemplars taken only from sampled spans.

    The trace-based filter keeps an exemplar when the measurement was made
    inside a sampled span, so an exemplar always points at a trace the backend
    actually has.
    """
    exporter = OTLPMetricExporter(endpoint=endpoint)
    reader = PeriodicExportingMetricReader(exporter, export_interval_millis=5_000)
    provider = MeterProvider(
        resource=resource,
        metric_readers=[reader],
        exemplar_filter=TraceBasedExemplarFilter(),
    )
    metrics.set_meter_provider(provider)


def _setup_logs(resource: Resource, endpoint: str) -> None:
    """Ship every Python log record to the OTel collector via OTLP gRPC.

    The OTLP handler is added only to the root logger. Because configure_logging()
    sets all loggers (including 'invana') with propagate=True and root.level=DEBUG,
    every record from every module — including third-party libraries — reaches root
    and is shipped to the OTel backend.

    Console suppression of noisy libs is handled separately by SuppressNoisyFilter
    on the console handler, so OTel still sees their records for debugging.

    The handler stamps ``principal`` · ``origin`` · ``graph_id`` on each record
    (they become log attributes) and redacts a record's fields by the same rule
    as the console handler.
    """
    # Local import avoids circular dependency at module load time.
    from opentelemetry.sdk._logs import LoggingHandler

    exporter = OTLPLogExporter(endpoint=endpoint)
    provider = LoggerProvider(resource=resource)
    provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    set_logger_provider(provider)

    from invana.core.logging.filters import OtlpThirdPartyFilter, RedactFilter, TraceContextFilter

    otlp_handler = LoggingHandler(level=logging.NOTSET, logger_provider=provider)
    otlp_handler.addFilter(OtlpThirdPartyFilter())
    # Who acted and from where become record attributes; credentials never do.
    otlp_handler.addFilter(TraceContextFilter())
    otlp_handler.addFilter(RedactFilter())
    logging.getLogger().addHandler(otlp_handler)
