"""Logging configuration for Invana."""

from __future__ import annotations

import copy
import logging
import logging.config

DEFAULT_LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        # Applied to the console handler — silences noisy libs from terminal output
        # WITHOUT dropping records from the pipeline. Third-party loggers still
        # propagate to root, so the OTel OTLP handler (when enabled) ships them to
        # the telemetry backend for analysis.
        "suppress_noisy": {
            "()": "invana.logging.filters.SuppressNoisyFilter",
        },
    },
    "formatters": {
        "simple": {
            "format": "{levelname} - {asctime} : {message}",
            "style": "{",
        },
        "json": {
            "()": "invana.logging.formatters.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "simple",
            "filters": ["suppress_noisy"],
        },
    },
    "root": {
        # DEBUG so every record is created and available to all handlers
        # (OTLP handler added by telemetry will see everything).
        # The console handler's suppress_noisy filter governs what appears on screen.
        "handlers": ["console"],
        "level": "DEBUG",
    },
    "loggers": {
        "invana": {
            # propagate=True: records flow up to root, where the OTLP handler lives.
            # The console handler on root has suppress_noisy but invana.* passes through,
            # so invana logs appear on console AND are shipped to OTel.
            "level": "DEBUG",
            "propagate": True,
        },
    },
}


def configure_logging(level: str = "INFO", config: dict | None = None) -> None:
    """
    Configure the Invana logging system.

    Args:
        level:  Log level for all Invana loggers (root + invana.*).
                Ignored when ``config`` is provided explicitly.
        config: A full :func:`logging.config.dictConfig`-compatible dict.
                When provided, ``level`` is ignored and this exact config is used.

    Examples::

        # Common case — level from settings
        configure_logging(level="DEBUG")

        # Fully custom config
        configure_logging(config={"version": 1, "root": {"level": "WARNING"}, ...})
    """
    if config is None:
        cfg = copy.deepcopy(DEFAULT_LOGGING_CONFIG)
        cfg["root"]["level"] = level
        cfg["handlers"]["console"]["level"] = level
        cfg["loggers"]["invana"]["level"] = level
        config = cfg
    logging.config.dictConfig(config)
