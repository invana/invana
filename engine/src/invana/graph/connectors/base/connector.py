"""Base connector abstract class."""

from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import nullcontext
from typing import Any, ClassVar

from invana.graph.connectors.base.exceptions import ConnectionError
from invana.graph.connectors.base.querysets.algorithms import BaseAlgorithmsQuerySet
from invana.graph.connectors.base.querysets.bulk import BaseBulkQuerySet
from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet
from invana.graph.connectors.base.querysets.data_writer import BaseDataWriterQuerySet
from invana.graph.connectors.base.querysets.schema_reader import BaseSchemaReaderQuerySet
from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet
from invana.graph.connectors.base.querysets.vector import BaseVectorQuerySet
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.types.capabilities import (
    CapabilityProfile,
    ResolvedCapabilities,
    Version,
)
from invana.graph.types.constants import Capability, PropertyType
from invana.graph.types.data_elements import GraphResponse

# OpenTelemetry lives in the optional ``telemetry`` extra (RFC-007/025). Core
# connector code must import cleanly without it, so resolve a tracer lazily and
# fall back to no-op ``nullcontext`` spans when it isn't installed.
try:
    from opentelemetry import trace as _otel_trace

    _tracer = _otel_trace.get_tracer("invana.graph")
except ImportError:  # telemetry extra not installed
    _tracer = None


def _query_span(name: str):
    """Start an OTel span for a query stage, or a no-op when telemetry is absent."""
    if _tracer is None:
        return nullcontext(None)
    return _tracer.start_as_current_span(name)


class BaseConnector(ABC):
    """Base connector for all graph databases.

    Access: connector.<queryset>.<method>()
    Lifecycle: async context manager or explicit connect()/disconnect().
    """

    data_reader: BaseDataReaderQuerySet
    data_writer: BaseDataWriterQuerySet
    schema_reader: BaseSchemaReaderQuerySet
    schema_writer: BaseSchemaWriterQuerySet
    bulk: BaseBulkQuerySet
    algorithms: BaseAlgorithmsQuerySet
    vector: BaseVectorQuerySet | None

    # The canonical, version-aware capability model for this connector (RFC-022).
    # Family connectors set a baseline; vendors override via ``.merge()``. ``None``
    # means "no profile declared" → no capabilities/property types reported.
    _capability_profile: ClassVar[CapabilityProfile | None] = None

    def __init__(self, uri: str, *, pool_size: int = 10, **kwargs: Any) -> None:
        self._uri = uri
        self._pool_size = pool_size
        self._driver: Any = None
        self._connected: bool = False
        # Cached live server version, populated by ``connect()`` via ``detect_version()``.
        self._detected_version: Version | None = None
        self._serializer = self._create_serializer()
        self._init_querysets()

    @property
    def serializer(self) -> BaseSerializer:
        return self._serializer

    @property
    def detected_version(self) -> Version | None:
        """The server version cached at ``connect()`` time, if detected (RFC-022)."""
        return self._detected_version

    @abstractmethod
    def _create_serializer(self) -> BaseSerializer: ...

    @abstractmethod
    def _init_querysets(self) -> None:
        """Wire up self.data_reader, self.data_writer, self.schema_reader, etc."""

    # --- These 4 are what integration packages implement ---
    @abstractmethod
    async def _create_driver(self) -> Any:
        """Create the vendor-specific driver instance."""

    @abstractmethod
    async def _close_driver(self) -> None:
        """Close the vendor-specific driver."""

    @abstractmethod
    async def _execute_raw(self, query: str, parameters: dict | None = None) -> Any:
        """Execute a raw query via the vendor driver and return raw results."""

    async def execute(self, query: str, parameters: dict | None = None) -> GraphResponse:
        """Execute a query and return a fully deserialised GraphResponse.

        Split into two child spans (RFC-025) so the trace separates the raw
        driver round-trip (``graph.query.db_execute``) from result
        deserialisation (``graph.query.serialize``) — the same FE→BE→FE trace
        the studio joins via W3C trace-context propagation.
        """
        with _query_span("graph.query.db_execute"):
            raw = await self._execute_raw(query, parameters)
        with _query_span("graph.query.serialize") as span:
            response = self._serializer.deserialize_graph_response(raw)
            if span is not None:
                span.set_attribute("invana.graph.node_count", len(response.nodes))
                span.set_attribute("invana.graph.edge_count", len(response.edges))
            return response

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify the connection is alive."""

    # --- End of integration-implemented methods ---

    async def detect_version(self) -> Version | None:
        """Best-effort detection of the live server version (RFC-022).

        Family connectors override this (Cypher: ``dbms.components()``; Gremlin:
        best-effort). The default returns ``None`` → the connection is treated as
        ``UNKNOWN`` and degraded to read-only until a version is established.
        """
        return None

    def resolve_capabilities(self, version: Version | None = None) -> ResolvedCapabilities:
        """Resolve this connector's capabilities for a server version (RFC-022).

        Uses the explicit ``version`` if given, else the cached detected version.
        Pure — no I/O — so callers can resolve offline from the class profile.
        """
        profile = type(self)._capability_profile
        if profile is None:
            return ResolvedCapabilities.empty()
        return profile.resolve(version if version is not None else self._detected_version)

    def capabilities(self) -> set[Capability]:
        """Feature-flag capabilities for the (cached) server version.

        Back-compat shim over :meth:`resolve_capabilities` — existing callers
        (projector, introspector, query routes) keep working unchanged.
        """
        return set(self.resolve_capabilities().capabilities)

    def supported_property_types(self, version: Version | None = None) -> set[PropertyType]:
        """Canonical property types this connector supports for ``version``."""
        return set(self.resolve_capabilities(version).property_types)

    async def connect(self) -> None:
        """Create the driver, verify connectivity, and detect the server version.

        ``health_check()`` returns ``False`` (rather than raising) when the server
        rejects the connection — e.g. bad credentials or an unreachable host. We must
        surface that as a failure so callers (the test-connection endpoint, the
        manager) don't treat an unauthenticated connection as healthy.
        """
        self._driver = await self._create_driver()
        self._connected = True
        if not await self.health_check():
            await self.disconnect()
            raise ConnectionError(
                "Connected to the server but the health check failed — verify the URI, credentials, and database name."
            )
        try:
            self._detected_version = await self.detect_version()
        except Exception:
            # Version detection is best-effort — a failure leaves the connection
            # UNKNOWN (read-only) but must never block a healthy connect.
            self._detected_version = None

    async def disconnect(self) -> None:
        """Close the driver and mark the connector as disconnected."""
        if self._driver:
            await self._close_driver()
            self._connected = False

    async def __aenter__(self) -> BaseConnector:
        await self.connect()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.disconnect()
