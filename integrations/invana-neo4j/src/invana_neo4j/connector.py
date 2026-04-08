from __future__ import annotations

from typing import Any

import neo4j
from invana.graph.connectors.base.constants import Capability
from invana.graph.connectors.base.exceptions import ConnectionError, QueryExecutionError
from invana.graph.connectors.cypher.connector import OpenCypherConnector
from neo4j import AsyncGraphDatabase

from invana_neo4j.querysets.algorithms import Neo4jAlgorithmsQuerySet
from invana_neo4j.querysets.schema_reader import Neo4jSchemaReaderQuerySet
from invana_neo4j.querysets.schema_writer import Neo4jSchemaWriterQuerySet


class Neo4jConnector(OpenCypherConnector):
    """Neo4j connector using the official neo4j-python async driver."""

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

    def _init_querysets(self) -> None:
        super()._init_querysets()
        # Override with Neo4j-specific implementations
        self.schema_reader = Neo4jSchemaReaderQuerySet(self)
        self.schema_writer = Neo4jSchemaWriterQuerySet(self)
        self.algorithms = Neo4jAlgorithmsQuerySet(self)

    async def _create_driver(self) -> neo4j.AsyncDriver:
        try:
            driver = AsyncGraphDatabase.driver(
                self._uri,
                auth=(self._username, self._password),
                max_connection_pool_size=self._pool_size,
            )
            return driver
        except Exception as e:
            raise ConnectionError(f"Failed to create Neo4j driver: {e}") from e

    async def _close_driver(self) -> None:
        if self._driver:
            await self._driver.close()

    async def execute(self, query: str, parameters: dict | None = None) -> list[neo4j.Record]:
        try:
            async with self._driver.session(database=self._database) as session:
                result = await session.run(query, parameters or {})
                records = [record async for record in result]
                return records
        except neo4j.exceptions.Neo4jError as e:
            raise QueryExecutionError(f"Neo4j query failed: {e}") from e
        except Exception as e:
            raise QueryExecutionError(f"Query execution failed: {e}") from e

    async def health_check(self) -> bool:
        try:
            await self._driver.verify_connectivity()
            return True
        except Exception:
            return False

    def capabilities(self) -> set[Capability]:
        return {
            Capability.CYPHER,
            Capability.TRANSACTIONS,
            Capability.SCHEMA_ENFORCEMENT,
            Capability.FULLTEXT_INDEX,
        }
