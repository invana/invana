"""OpenCypher connector implementation."""

from __future__ import annotations

from typing import Any, ClassVar

import neo4j
from neo4j import AsyncGraphDatabase

from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.connectors.base.exceptions import (
    ConnectionError,
    QueryErrorCategory,
    QueryExecutionError,
)
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.connectors.cypher.lens import CypherLensCompiler
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder
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


def _classify_neo4j_error(code: str | None) -> str:
    """Bucket a Neo4j ``Neo.*`` status code into a ``QueryErrorCategory``.

    Codes look like ``Neo.ClientError.Statement.SyntaxError`` /
    ``Neo.ClientError.Transaction.TransactionTimedOut``. We match on the tail
    rather than the full string so server-version wording changes don't break
    classification. A mistranslated NL query almost always lands as a
    ``SyntaxError``; everything we can't place stays ``unknown``.
    """
    code = code or ""
    if code.endswith("SyntaxError"):
        return QueryErrorCategory.SYNTAX
    if "TimedOut" in code or "Timeout" in code:
        return QueryErrorCategory.TIMEOUT
    return QueryErrorCategory.UNKNOWN


# openCypher baseline capability profile (docs/for-developers/modules/graph-connectors/features/capabilities.md). Covers
# Neo4j + Memgraph, which
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

    #: The builder this connector's querysets compose with. A vendor whose dialect
    #: differs — Memgraph's ``id()`` for ``elementId()`` — subclasses the builder and
    #: names it here, rather than every queryset reaching for one fixed class
    #: (docs/for-developers/modules/graph-connectors/features/languages.md LG10).
    query_builder: ClassVar[type[OpenCypherQueryBuilder]] = OpenCypherQueryBuilder

    def lens_compiler(self) -> CypherLensCompiler:
        """Built with **this connection's** builder, so the projection it writes
        uses the same identity function every other query here uses (LG10)."""
        return CypherLensCompiler(self.query_builder)

    def classify_error(self, code: str | None, message: str) -> str:
        """Bucket a failed query into a :class:`QueryErrorCategory`.

        Neo4j says which kind of failure it was in the **code**, so that is what
        the default reads. A vendor that does not — Memgraph returns one code for
        everything — overrides this and reads whatever it does carry. The bucket
        picks the user-facing copy (*the model mistranslated* vs *the question was
        too expensive*), so a vendor that cannot be classified gets generic copy
        rather than wrong copy.
        """
        return _classify_neo4j_error(code)

    def coerce_id(self, id_value: str) -> Any:
        """An element id, in the type this vendor's id function compares against.

        ``elementId()`` returns a string, so the default is identity. Memgraph's
        ``id()`` returns an **integer**, and ``id(n) = "428"`` does not fail — it
        simply matches nothing, which is the worst way for this to be wrong.
        """
        return id_value

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
            raise QueryExecutionError(
                f"Neo4j query failed: {exc}",
                code=exc.code,
                category=self.classify_error(exc.code, str(exc)),
            ) from exc
        except Exception as exc:
            raise QueryExecutionError(f"Query execution failed: {exc}") from exc

    async def health_check(self) -> bool:
        try:
            await self._driver.verify_connectivity()
            # ``verify_connectivity()`` proves the *server* is reachable; it is not
            # bound to a database. A connection names the database it reads
            # (connect-a-database.md CD8), so the check has to go through that
            # database — otherwise a misspelt name passes Test, unlocks Save, and
            # fails every query made afterwards.
            await self._execute_raw("RETURN 1")
            return True
        except Exception:
            return False
