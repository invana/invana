"""
Invana — Graph Intelligence Platform.

Importing this package bootstraps two cross-cutting concerns automatically:

1. Logging — configure_logging() sets up console output, log level, and module
   suppression.  Called first so the log pipeline exists before anything else runs.

2. Telemetry (optional) — setup_telemetry() adds OTel providers (traces, metrics,
   logs) when INVANA_TELEMETRY_ENABLED=true.  The telemetry layer adds its OTLP log
   handler on top of the already-configured logging pipeline; calling it after
   configure_logging() ensures dictConfig never overwrites the OTLP handler.

Every entry point — server, CLI, loaders, fixtures — gets both layers for free just
by importing invana.
"""

from __future__ import annotations

from invana.logging import configure_logging
from invana.settings import settings

configure_logging(level=settings.log_level)

if settings.telemetry_enabled:
    try:
        from invana.telemetry import setup_telemetry
    except ImportError as exc:
        raise ImportError(
            "OpenTelemetry packages are required when INVANA_TELEMETRY_ENABLED=true. "
            "Install them with: uv sync --extra telemetry"
        ) from exc

    setup_telemetry(
        service_name=settings.telemetry_service_name,
        service_version=settings.app_version,
        otlp_endpoint=settings.telemetry_otlp_endpoint,
        environment=settings.telemetry_environment,
    )
