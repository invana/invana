"""Custom log filters for Invana."""

from __future__ import annotations

import logging

# Loggers whose output we suppress from the console.
# These still propagate to root so the OTel OTLP handler can ship them
# to the telemetry backend for analysis.
_CONSOLE_SUPPRESS = frozenset(
    {
        "neo4j",
        "gremlin_python",
        "gremlinpython",
        "asyncio",
        "httpcore",
        "httpx",
    }
)


class SuppressNoisyFilter(logging.Filter):
    """
    Suppresses noisy third-party logger output from the console handler.

    Records from suppressed loggers are NOT dropped from the logging pipeline —
    they still propagate to root and are picked up by the OTel OTLP handler
    (when telemetry is enabled) so they can be analysed in the backend.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        for suppressed in _CONSOLE_SUPPRESS:
            if record.name == suppressed or record.name.startswith(suppressed + "."):
                return False
        return True


class OtlpThirdPartyFilter(logging.Filter):
    """
    Applied to the OTLP log handler.

    - invana.* loggers: ship everything (DEBUG and above).
    - All other loggers: ship WARNING and above only (covers WARNING, ERROR, CRITICAL).

    This keeps the OTel backend useful for debugging invana internals while
    avoiding a flood of third-party driver protocol messages.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "invana" or record.name.startswith("invana."):
            return True
        return record.levelno >= logging.WARNING
