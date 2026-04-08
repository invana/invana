"""Shared fixtures for invana-neo4j integration tests.

Requires a running Neo4j instance. Default: bolt://localhost:7687, neo4j/testpassword
Override with environment variables: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE
"""

import contextlib
import os

import pytest

from invana_neo4j import Neo4jConnector

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "testpassword")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")


@pytest.fixture
async def connector():
    """Provides a connected Neo4jConnector and cleans up data after each test."""
    conn = Neo4jConnector(
        NEO4J_URI,
        username=NEO4J_USERNAME,
        password=NEO4J_PASSWORD,
        database=NEO4J_DATABASE,
    )
    await conn.connect()
    yield conn
    # Clean up all test data after each test
    await conn.execute("MATCH (n) DETACH DELETE n")
    # Drop user-created constraints (before indexes — constraints have backing indexes)
    constraints = await conn.execute("SHOW CONSTRAINTS YIELD name RETURN name")
    for cst in constraints:
        with contextlib.suppress(Exception):
            await conn.execute(f"DROP CONSTRAINT `{cst['name']}`")
    # Drop user-created indexes (skip LOOKUP indexes)
    indexes = await conn.execute("SHOW INDEXES YIELD name, type WHERE type <> 'LOOKUP' RETURN name")
    for idx in indexes:
        with contextlib.suppress(Exception):
            await conn.execute(f"DROP INDEX `{idx['name']}`")
    # Drop any leftover GDS projections
    try:
        projections = await conn.execute("CALL gds.graph.list() YIELD graphName RETURN graphName")
        for proj in projections:
            with contextlib.suppress(Exception):
                await conn.execute("CALL gds.graph.drop($name)", {"name": proj["graphName"]})
    except Exception:
        pass  # GDS might not be installed
    await conn.disconnect()


@pytest.fixture
async def gds_available(connector):
    """Skip the test if GDS plugin is not installed."""
    try:
        await connector.execute("RETURN gds.version() AS version")
    except Exception:
        pytest.skip("Neo4j GDS plugin not available")
