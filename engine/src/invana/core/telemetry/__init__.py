"""Invana telemetry — OpenTelemetry traces, metrics, and logs.

Public API
----------
setup_telemetry()       Register OTel providers (traces/metrics/logs). Idempotent.
instrument_app()        Add SQLAlchemy auto-instrumentation. Call in lifespan.
instrument_process()    Instrument every engine created afterwards (the CLI). Idempotent.
flush_telemetry()       Export what the providers still hold, within a time budget.
TelemetryMiddleware     Pure-ASGI middleware that spans every HTTP request.

Decorators (import from invana.core.telemetry.decorators):
  @track()              Wrap any async/sync method in an OTel span.
  @capture_metrics()    Record domain-specific metrics per method call.

Everything here is resolved lazily via ``__getattr__`` so that importing the
package (e.g. ``invana.telemetry.recorders`` from the connector / LLM client) does
not pull in OpenTelemetry — the optional ``telemetry`` extra
(docs/for-developers/modules/operate/features/observability.md).
"""

__all__ = [
    "TelemetryMiddleware",
    "flush_telemetry",
    "instrument_app",
    "instrument_process",
    "setup_telemetry",
]


def __getattr__(name: str):
    if name == "TelemetryMiddleware":
        from invana.core.telemetry.middleware import TelemetryMiddleware

        return TelemetryMiddleware
    if name in ("flush_telemetry", "instrument_app", "instrument_process", "setup_telemetry"):
        from invana.core.telemetry import setup

        return getattr(setup, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
