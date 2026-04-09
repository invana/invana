"""Invana logging — configure once, use logging.getLogger(__name__) everywhere."""

from .config import DEFAULT_LOGGING_CONFIG, configure_logging

__all__ = ["configure_logging", "DEFAULT_LOGGING_CONFIG"]
