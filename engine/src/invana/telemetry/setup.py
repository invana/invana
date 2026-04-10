"""
Telemetry bootstrap.

Two public entry points:

  setup_telemetry()   — Registers OTel providers (traces, metrics, logs).
                        Idempotent — safe to call multiple times; initialises once.
                        Called from server lifespan when INVANA_TELEMETRY_ENABLED=true.

  instrument_app()    — Adds FastAPI + SQLAlchemy auto-instrumentation.
                        Call once inside the FastAPI lifespan after the DB engine exists.

Instruments:
  - FastAPI          (all routes, request/response timings)
  - SQLAlchemy       (all app-state DB queries, trace context injected into SQL comments)
  - Python logging   (trace_id/span_id injected into every log record)
  - Custom spans     (via @track decorator)
  - Custom metrics   (via @capture_metrics decorator and metrics.py instruments)

Signals exported via OTLP gRPC to any OTel-compatible backend (HyperDX, Signoz, etc.).
"""

from __future__ import annotations

import logging

from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger("invana.telemetry")

_providers_initialised = False


def setup_telemetry(
    service_name: str = "invana-engine",
    service_version: str = "0.0.0",
    otlp_endpoint: str = "http://localhost:4317",
    environment: str = "development",
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
        }
    )

    _setup_traces(resource, otlp_endpoint)
    _setup_metrics(resource, otlp_endpoint)
    _setup_logs(resource, otlp_endpoint)

    # Inject trace_id + span_id into every Python log record.
    LoggingInstrumentor().instrument(set_logging_format=True)

    _providers_initialised = True
    logger.info(
        "Telemetry initialised → %s  service=%s  env=%s",
        otlp_endpoint,
        service_name,
        environment,
    )


def instrument_app(app, engine) -> None:
    """
    Add FastAPI and SQLAlchemy auto-instrumentation.

    Call this once inside the FastAPI lifespan after the DB engine is ready.
    Requires setup_telemetry() to have been called first.

    Parameters
    ----------
    app:    The FastAPI application instance.
    engine: The SQLAlchemy async engine (from create_db_engine()).
    """
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # requires --extra server

    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls="health,metrics,ping",
    )
    SQLAlchemyInstrumentor().instrument(
        engine=engine,
        enable_commenter=True,  # injects trace-context into SQL comments
    )


# ── internals ─────────────────────────────────────────────────────────────────


def _setup_traces(resource: Resource, endpoint: str) -> None:
    exporter = OTLPSpanExporter(endpoint=endpoint)
    provider = TracerProvider(resource=resource)
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

    from invana.logging.filters import OtlpThirdPartyFilter

    otlp_handler = LoggingHandler(level=logging.NOTSET, logger_provider=provider)
    otlp_handler.addFilter(OtlpThirdPartyFilter())
    logging.getLogger().addHandler(otlp_handler)
