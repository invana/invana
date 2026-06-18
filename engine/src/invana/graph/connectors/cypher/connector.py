"""OpenCypher connector implementation."""

from __future__ import annotations

from typing import Any

import neo4j
from neo4j import AsyncGraphDatabase

from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.connectors.base.exceptions import ConnectionError, QueryExecutionError
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.connectors.cypher.querysets.algorithms import OpenCypherAlgorithmsQuerySet
from invana.graph.connectors.cypher.querysets.bulk import OpenCypherBulkQuerySet
from invana.graph.connectors.cypher.querysets.data_reader import OpenCypherDataReaderQuerySet
from invana.graph.connectors.cypher.querysets.data_writer import OpenCypherDataWriterQuerySet
from invana.graph.connectors.cypher.querysets.schema_reader import OpenCypherSchemaReaderQuerySet
from invana.graph.connectors.cypher.querysets.schema_writer import OpenCypherSchemaWriterQuerySet
from invana.graph.connectors.cypher.querysets.vector import OpenCypherVectorQuerySet
from invana.graph.connectors.cypher.serializers import OpenCypherSerializer
from invana.graph.types.capabilities import (
    CapabilityProfile,
    Version,
    always,
    overlay,
)
from invana.graph.types.constants import Capability, PropertyType, QueryLanguage

# openCypher baseline capability profile (RFC-022). Covers Neo4j + Memgraph, which
# both speak Bolt/openCypher. Vendor connectors (e.g. invana-neo4j) narrow the
# version window and add vendor features via ``CYPHER_PROFILE.merge(...)``.
CYPHER_PROFILE = CapabilityProfile(
    family=QueryLanguage.CYPHER,
    min_version=Version(4, 0),
    tested_max=Version(5, 26),
    property_types={
        PropertyType.STRING: always(),
        PropertyType.INTEGER: always(),
        PropertyType.FLOAT: always(),
        PropertyType.BOOLEAN: always(),
        PropertyType.ENUM: overlay(),
        PropertyType.UUID: overlay(),
        PropertyType.JSON: overlay(),
        # openCypher temporal + spatial values
        PropertyType.DATE: always(),
        PropertyType.TIME: always(),
        PropertyType.DATETIME: always(),
        PropertyType.DURATION: always(),
        PropertyType.POINT: always(),
        PropertyType.LIST: always(),
    },
    features={
        Capability.CYPHER: always(),
        Capability.TRANSACTIONS: always(),
    },
)


class OpenCypherConnector(BaseConnector):
    """Generic openCypher connector using the neo4j async driver.

    Works out of the box with Neo4j and Memgraph (both speak Bolt/openCypher).
    Integration packages (e.g. ``invana-neo4j``) can extend this class to add
    richer schema operations, index management, and algorithm support — they do
    not need to re-implement the driver lifecycle.

    Args:
        uri: Bolt connection URI, e.g. ``bolt://localhost:7687``.
        username: Database username (default ``neo4j``).
        password: Database password.
        database: Target database name (default ``neo4j``).
        pool_size: Max connections in the driver pool.
    """

    def __init__(
        self,
        uri: str,
        *,
        username: str = "neo4j",
        password: str = "",
        database: str = "neo4j",
        pool_size: int = 10,
        **kwargs: Any,
    ) -> None:
        self._username = username
        self._password = password
        self._database = database
        super().__init__(uri, pool_size=pool_size, **kwargs)

    def _create_serializer(self) -> BaseSerializer:
        return OpenCypherSerializer()

    def _init_querysets(self) -> None:
        self.data_reader = OpenCypherDataReaderQuerySet(self)
        self.data_writer = OpenCypherDataWriterQuerySet(self)
        self.schema_reader = OpenCypherSchemaReaderQuerySet(self)
        self.schema_writer = OpenCypherSchemaWriterQuerySet(self)
        self.bulk = OpenCypherBulkQuerySet(self)
        self.algorithms = OpenCypherAlgorithmsQuerySet(self)
        self.vector = OpenCypherVectorQuerySet(self)

    _capability_profile = CYPHER_PROFILE

    async def detect_version(self) -> Version | None:
        """Detect the server version via ``dbms.components()`` (Memgraph: ``SHOW VERSION``)."""
        for query in (
            "CALL dbms.components() YIELD versions RETURN versions[0] AS v",
            "SHOW VERSION",
        ):
            try:
                records = await self._execute_raw(query)
            except Exception:
                continue
            if not records:
                continue
            values = list(records[0].values())
            if not values:
                continue
            version = Version.parse(str(values[0]))
            if version is not None:
                return version
        return None

    async def _create_driver(self) -> neo4j.AsyncDriver:
        try:
            return AsyncGraphDatabase.driver(
                self._uri,
                auth=(self._username, self._password),
                max_connection_pool_size=self._pool_size,
            )
        except Exception as exc:
            raise ConnectionError(f"Failed to create Neo4j driver: {exc}") from exc

    async def _close_driver(self) -> None:
        if self._driver:
            await self._driver.close()

    async def _execute_raw(
        self, query: str, parameters: dict | None = None, *, timeout_s: float | None = None
    ) -> list[neo4j.Record]:
        try:
            async with self._driver.session(database=self._database) as session:
                # ``timeout`` is the server-side transaction timeout (seconds);
                # the driver omits it when None, leaving the query unbounded.
                result = await session.run(query, parameters or {}, timeout=timeout_s)
                return [record async for record in result]
        except neo4j.exceptions.Neo4jError as exc:
            raise QueryExecutionError(f"Neo4j query failed: {exc}") from exc
        except Exception as exc:
            raise QueryExecutionError(f"Query execution failed: {exc}") from exc

    async def health_check(self) -> bool:
        try:
            await self._driver.verify_connectivity()
            return True
        except Exception:
            return False
