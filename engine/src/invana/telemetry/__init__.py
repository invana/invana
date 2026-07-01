"""Invana telemetry — OpenTelemetry traces, metrics, and logs.

Public API
----------
setup_telemetry()       Register OTel providers (traces/metrics/logs). Idempotent.
instrument_app()        Add FastAPI + SQLAlchemy auto-instrumentation. Call in lifespan.
TelemetryMiddleware     Pure-ASGI middleware that spans every HTTP request.

Decorators (import from invana.telemetry.decorators):
  @track()              Wrap any async/sync method in an OTel span.
  @capture_metrics()    Record domain-specific metrics per method call.

Everything here is resolved lazily via ``__getattr__`` so that importing the
package (e.g. ``invana.telemetry.recorders`` from the connector / LLM client) does
not pull in OpenTelemetry — the optional ``telemetry`` extra (RFC-041).
"""

__all__ = ["TelemetryMiddleware", "instrument_app", "setup_telemetry"]


def __getattr__(name: str):
    if name == "TelemetryMiddleware":
        from invana.telemetry.middleware import TelemetryMiddleware

        return TelemetryMiddleware
    if name in ("instrument_app", "setup_telemetry"):
        from invana.telemetry import setup

        return getattr(setup, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
