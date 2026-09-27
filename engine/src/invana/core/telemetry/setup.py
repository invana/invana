"""
Telemetry bootstrap.

Two public entry points:

  setup_telemetry()   — Registers OTel providers (traces, metrics, logs).
                        Idempotent — safe to call multiple times; initialises once.
                        Called from server lifespan when INVANA_TELEMETRY_ENABLED=true.

  instrument_app()    — Adds SQLAlchemy auto-instrumentation.
                        Call once inside the FastAPI lifespan after the DB engine exists.

Instruments:
  - HTTP requests    (TelemetryMiddleware — the only source of request spans; it is
                      added when the app is built, because instrumentation applied
                      from the lifespan runs after Starlette has already built its
                      middleware stack and never takes effect)
  - SQLAlchemy       (all app-state DB queries, trace context injected into SQL comments)
  - Python logging   (every record shipped over OTLP carries its span context; the
                      console format gets trace ids from the logging filters)
  - Custom spans     (via @track decorator)
  - Custom metrics   (via @capture_metrics decorator and metrics.py instruments)

Sampling:
  Traces are sampled by trace id at ``sample_ratio`` for new root traces; a request
  that arrives with a parent (e.g. the studio's ``traceparent``) follows the
  parent's decision, so a distributed trace is kept or dropped as a whole.

Signals exported via OTLP gRPC to any OTel-compatible backend (HyperDX, Signoz, etc.).
"""

from __future__ import annotations

import logging

from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
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
    exporter = OTLPMetricExporter(endpoint=endpoint)
    reader = PeriodicExportingMetricReader(exporter, export_interval_millis=5_000)
    provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(provider)


def _setup_logs(resource: Resource, endpoint: str) -> None:
    """Ship every Python log record to the OTel collector via OTLP gRPC.

    The OTLP handler is added only to the root logger. Because configure_logging()
    sets all loggers (including 'invana') with propagate=True and root.level=DEBUG,
    every record from every module — including third-party libraries — reaches root
    and is shipped to the OTel backend.

    Console suppression of noisy libs is handled separately by SuppressNoisyFilter
    on the console handler, so OTel still sees their records for debugging.
    """
    # Local import avoids circular dependency at module load time.
    from opentelemetry.sdk._logs import LoggingHandler

    exporter = OTLPLogExporter(endpoint=endpoint)
    provider = LoggerProvider(resource=resource)
    provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    set_logger_provider(provider)

    from invana.core.logging.filters import OtlpThirdPartyFilter

    otlp_handler = LoggingHandler(level=logging.NOTSET, logger_provider=provider)
    otlp_handler.addFilter(OtlpThirdPartyFilter())
    logging.getLogger().addHandler(otlp_handler)
