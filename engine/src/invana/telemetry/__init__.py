"""Invana telemetry — OpenTelemetry traces, metrics, and logs.

Public API
----------
setup_telemetry()       Register OTel providers (traces/metrics/logs). Idempotent.
instrument_app()        Add FastAPI + SQLAlchemy auto-instrumentation. Call in lifespan.
TelemetryMiddleware     Pure-ASGI middleware that spans every HTTP request.

Decorators (import from invana.telemetry.decorators):
  @track()              Wrap any async/sync method in an OTel span.
  @capture_metrics()    Record domain-specific metrics per method call.
"""

from invana.telemetry.setup import instrument_app, setup_telemetry

__all__ = ["TelemetryMiddleware", "instrument_app", "setup_telemetry"]


def __getattr__(name: str):
    if name == "TelemetryMiddleware":
        from invana.telemetry.middleware import TelemetryMiddleware

        return TelemetryMiddleware
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
