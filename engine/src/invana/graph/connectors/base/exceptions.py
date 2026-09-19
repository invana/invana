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


class LensViolationError(ConnectorError):
    """A query was refused by the lens, before the wire
    (docs/for-developers/modules/graph-connectors/features/the-connector-contract.md).

    Not a ``QueryExecutionError``: nothing was executed and nothing failed. The
    query named something this world does not hold, or had a shape the compiler
    could not bound — and a bound that fails open is not a bound (CN10).

    ``code`` is one of:

    ``lens_type_denied``
        the query names a type this world does not hold.
    ``lens_property_excluded``
        the query names a property this world does not carry — anywhere, the
        inside of an aggregate included.
    ``lens_unreadable``
        the query's shape is outside the readable subset, so the compiler cannot
        prove the bound holds.
    ``lens_unprojectable``
        a type excludes properties but declares none, so there is nothing to
        project to.
    ``lens_not_supported``
        this query language has no governed path.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str,
        type_name: str | None = None,
        property_name: str | None = None,
        fragment: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.type_name = type_name
        self.property_name = property_name
        self.fragment = fragment

    @property
    def evidence(self) -> dict[str, str]:
        """The addresses that explain the refusal — never a payload, never a row."""
        found = {
            "code": self.code,
            "type": self.type_name,
            "property": self.property_name,
            "fragment": self.fragment,
        }
        return {k: v for k, v in found.items() if v}


class SerializationError(ConnectorError):
    """Failed to serialize/deserialize results."""
