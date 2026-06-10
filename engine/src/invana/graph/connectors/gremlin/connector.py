"""Gremlin connector implementation.

Provides a concrete connector for all Gremlin-compatible graph databases
(JanusGraph, ArcadeDB, Neptune, TinkerGraph). Uses the gremlinpython driver
for WebSocket-based connections with optional username/password authentication.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Any

from gremlin_python.driver.aiohttp.transport import AiohttpTransport
from gremlin_python.driver.client import Client
from gremlin_python.driver.driver_remote_connection import DriverRemoteConnection
from gremlin_python.process.anonymous_traversal import traversal
from gremlin_python.process.graph_traversal import GraphTraversalSource

from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.connectors.base.exceptions import ConnectionError, QueryExecutionError
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.connectors.gremlin.querysets.algorithms import GremlinAlgorithmsQuerySet
from invana.graph.connectors.gremlin.querysets.bulk import GremlinBulkQuerySet
from invana.graph.connectors.gremlin.querysets.data_reader import GremlinDataReaderQuerySet
from invana.graph.connectors.gremlin.querysets.data_writer import GremlinDataWriterQuerySet
from invana.graph.connectors.gremlin.querysets.schema_reader import GremlinSchemaReaderQuerySet
from invana.graph.connectors.gremlin.querysets.schema_writer import GremlinSchemaWriterQuerySet
from invana.graph.connectors.gremlin.querysets.vector import GremlinVectorQuerySet
from invana.graph.connectors.gremlin.serializers import GremlinSerializer
from invana.graph.types.capabilities import (
    CapabilityProfile,
    Version,
    always,
    overlay,
)
from invana.graph.types.constants import Capability, PropertyType, QueryLanguage

# TinkerPop/Gremlin baseline capability profile (RFC-022). Gremlin has no native
# temporal/spatial property values, but `uuid` is native and properties carry a
# cardinality (single/list/set). Vendor connectors (JanusGraph, Neptune, …) override
# via ``GREMLIN_PROFILE.merge(...)`` when they gain real implementations.
GREMLIN_PROFILE = CapabilityProfile(
    family=QueryLanguage.GREMLIN,
    min_version=Version(3, 5),
    tested_max=Version(3, 8),
    property_types={
        PropertyType.STRING: always(),
        PropertyType.INTEGER: always(),
        PropertyType.FLOAT: always(),
        PropertyType.BOOLEAN: always(),
        PropertyType.UUID: always(),  # native in Gremlin
        PropertyType.ENUM: overlay(),
        PropertyType.JSON: overlay(),
        PropertyType.LIST: always(),  # list cardinality
        PropertyType.SET: always(),  # set cardinality
    },
    features={
        Capability.GREMLIN: always(),
    },
)


class GremlinConnector(BaseConnector):
    """Concrete Gremlin connector using gremlinpython WebSocket driver.

    This connector works with any Gremlin Server-compatible database.
    The only methods that integration packages *may* override are
    ``coerce_id()`` (for databases that use non-string IDs) and
    ``_create_driver()`` / ``_close_driver()`` for custom connection setup.

    Args:
        uri: Gremlin Server WebSocket URL (e.g., ``ws://localhost:8182/gremlin``).
        username: Optional username for authentication.
        password: Optional password for authentication.
        pool_size: Connection pool size.
    """

    def __init__(
        self,
        uri: str,
        *,
        username: str | None = None,
        password: str | None = None,
        pool_size: int = 10,
        **kwargs: Any,
    ) -> None:
        self._username = username
        self._password = password
        self._connection: DriverRemoteConnection | None = None
        self._g: GraphTraversalSource | None = None
        super().__init__(uri, pool_size=pool_size, **kwargs)

    def _create_serializer(self) -> BaseSerializer:
        return GremlinSerializer()

    def _init_querysets(self) -> None:
        self.data_reader = GremlinDataReaderQuerySet(self)
        self.data_writer = GremlinDataWriterQuerySet(self)
        self.schema_reader = GremlinSchemaReaderQuerySet(self)
        self.schema_writer = GremlinSchemaWriterQuerySet(self)
        self.bulk = GremlinBulkQuerySet(self)
        self.algorithms = GremlinAlgorithmsQuerySet(self)
        self.vector = GremlinVectorQuerySet(self)

    _capability_profile = GREMLIN_PROFILE

    # Groovy scripts that return the TinkerPop/Gremlin version string. A bytecode
    # traversal can't return the server version anywhere, so we submit a script.
    # The class moved packages across TinkerPop releases — try both.
    _VERSION_SCRIPTS = (
        "Gremlin.version()",
        "org.apache.tinkerpop.gremlin.util.Gremlin.version()",
    )

    async def detect_version(self) -> Version | None:
        """Best-effort TinkerPop version via the ``Gremlin.version()`` script (RFC-022).

        Works on any Gremlin Server that permits Groovy script evaluation —
        TinkerGraph, JanusGraph, and most self-hosted servers (this is the TinkerPop
        version the ``GREMLIN_PROFILE`` windows are keyed on). Returns ``None`` on
        servers that disable scripting (e.g. Amazon Neptune) → the connection starts
        read-only until the user declares a version, or a vendor connector overrides
        this with an HTTP probe (Neptune ``GET /status``; ArcadeDB ``GET /api/v1/server``).
        """

        def _probe() -> str | None:
            auth = {}
            if self._username is not None:
                auth["username"] = self._username
            if self._password is not None:
                auth["password"] = self._password
            client = Client(self._uri, "g", **auth)
            try:
                for script in self._VERSION_SCRIPTS:
                    try:
                        rows = client.submit(script).all().result()
                    except Exception:
                        continue
                    if rows:
                        return str(rows[0])
                return None
            finally:
                with contextlib.suppress(Exception):
                    client.close()

        try:
            raw = await asyncio.to_thread(_probe)
        except Exception:
            return None
        return Version.parse(raw)

    def coerce_id(self, id_value: str) -> Any:
        """Convert a string ID to the native type expected by the database.

        Override in integration packages for databases that use numeric IDs
        (e.g., JanusGraph uses long integers).
        """
        return id_value

    async def _create_driver(self) -> Any:
        """Create the Gremlin remote connection."""
        try:
            self._connection = DriverRemoteConnection(
                self._uri,
                "g",
                username=self._username,
                password=self._password,
                transport_factory=AiohttpTransport,
            )
            self._g = traversal().with_(self._connection)
            return self._connection
        except Exception as e:
            raise ConnectionError(f"Failed to create Gremlin connection: {e}") from e

    async def _close_driver(self) -> None:
        """Close the Gremlin remote connection."""
        if self._connection:
            with contextlib.suppress(Exception):
                await asyncio.to_thread(self._connection.close)
            self._connection = None
            self._g = None

    async def get_traversal_source(self) -> GraphTraversalSource:
        """Return the graph traversal source ``g``."""
        if self._g is None:
            raise ConnectionError("Not connected. Call connect() first.")
        return self._g

    async def _execute_raw(self, query: str, parameters: dict | None = None) -> Any:
        """Execute a raw Gremlin script string.

        For traversal-based execution, use ``execute_traversal()`` instead.
        """
        raise NotImplementedError(
            "GremlinConnector uses execute_traversal() for bytecode traversals. "
            "Raw string execution is not supported at the base level."
        )

    async def execute_traversal(self, traversal_obj: Any) -> list[Any]:
        """Execute a Gremlin traversal and return results as a list."""
        try:
            return await asyncio.to_thread(traversal_obj.to_list)
        except Exception as e:
            raise QueryExecutionError(f"Traversal execution failed: {e}") from e

    async def health_check(self) -> bool:
        """Verify connectivity by running a simple traversal."""
        try:
            g = await self.get_traversal_source()
            await self.execute_traversal(g.V().limit(1))
            return True
        except Exception:
            return False
