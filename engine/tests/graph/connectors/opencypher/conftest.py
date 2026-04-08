"""Shared fixtures for OpenCypher connector integration tests.

Uses Neo4j as the test backend for standard openCypher operations.
Requires: docker compose -f docker-compose-infra.yml up -d

Override with environment variables: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE
"""

from __future__ import annotations

import os
from typing import Any

import neo4j
import pytest
from neo4j import AsyncGraphDatabase

from invana.graph.connectors.base.constants import Capability
from invana.graph.connectors.base.exceptions import ConnectionError, QueryExecutionError
from invana.graph.connectors.cypher.connector import OpenCypherConnector

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "testpassword")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")


class TestOpenCypherConnector(OpenCypherConnector):
    """Concrete OpenCypher connector for testing — backed by Neo4j.

    This is NOT Neo4jConnector (which lives in invana-neo4j and has vendor overrides).
    This is a minimal concrete implementation used purely to validate the base
    OpenCypher querysets against a real Cypher database.
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

    async def _create_driver(self) -> neo4j.AsyncDriver:
        try:
            return AsyncGraphDatabase.driver(
                self._uri,
                auth=(self._username, self._password),
                max_connection_pool_size=self._pool_size,
            )
        except Exception as e:
            raise ConnectionError(f"Failed to create driver: {e}") from e

    async def _close_driver(self) -> None:
        if self._driver:
            await self._driver.close()

    async def execute(self, query: str, parameters: dict | None = None) -> list[neo4j.Record]:
        try:
            async with self._driver.session(database=self._database) as session:
                result = await session.run(query, parameters or {})
                return [record async for record in result]
        except neo4j.exceptions.Neo4jError as e:
            raise QueryExecutionError(f"Query failed: {e}") from e
        except Exception as e:
            raise QueryExecutionError(f"Query execution failed: {e}") from e

    async def health_check(self) -> bool:
        try:
            await self._driver.verify_connectivity()
            return True
        except Exception:
            return False

    def capabilities(self) -> set[Capability]:
        return {Capability.CYPHER, Capability.TRANSACTIONS}


@pytest.fixture
async def connector():
    """Provides a connected OpenCypher connector and cleans up after each test."""
    conn = TestOpenCypherConnector(
        NEO4J_URI,
        username=NEO4J_USERNAME,
        password=NEO4J_PASSWORD,
        database=NEO4J_DATABASE,
    )
    await conn.connect()
    yield conn
    # Clean up all test data
    await conn.execute("MATCH (n) DETACH DELETE n")
    await conn.disconnect()
