"""Logging configuration for Invana."""

from __future__ import annotations

import logging
import logging.config

DEFAULT_LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
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
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "invana": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # Suppress verbose output from third-party graph driver libraries.
        "neo4j": {"level": "CRITICAL", "propagate": True},
        "gremlin_python": {"level": "ERROR", "propagate": True},
        "gremlinpython": {"level": "ERROR", "propagate": True},
    },
}


def configure_logging(config: dict | None = None) -> None:
    """
    Configure the Invana logging system.

    Args:
        config: A :func:`logging.config.dictConfig`-compatible dict.
                Defaults to ``DEFAULT_LOGGING_CONFIG`` when omitted.

    Examples::

        # Common case
        configure_logging()

        # Custom config (integration packages, custom deployments)
        configure_logging({"version": 1, "root": {"level": "WARNING"}, ...})
    """
    logging.config.dictConfig(config if config is not None else DEFAULT_LOGGING_CONFIG)
