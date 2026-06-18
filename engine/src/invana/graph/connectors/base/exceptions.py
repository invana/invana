"""Connector exception hierarchy."""

from __future__ import annotations


class QueryErrorCategory:
    """Coarse, vendor-agnostic buckets for a failed query.

    Used to pick user-facing copy without leaking the raw driver message: a
    ``syntax`` failure in NL mode means the model mistranslated, a ``timeout``
    means the question was too expensive, ``unknown`` is everything else.
    """

    SYNTAX = "syntax"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"


class ConnectorError(Exception):
    """Base exception for all connector errors."""


class ConnectionError(ConnectorError):
    """Failed to connect or lost connection."""


class QueryExecutionError(ConnectorError):
    """Query failed during execution.

    ``code`` is the raw vendor error code (e.g. Neo4j's
    ``Neo.ClientError.Statement.SyntaxError``) when the driver exposes one;
    ``category`` is its classification into a ``QueryErrorCategory`` bucket.
    Both default to "unknown" so callers can read them unconditionally.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        category: str = QueryErrorCategory.UNKNOWN,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.category = category


class NotSupportedError(ConnectorError):
    """Feature not supported by this connector/vendor."""


class SerializationError(ConnectorError):
    """Failed to serialize/deserialize results."""
