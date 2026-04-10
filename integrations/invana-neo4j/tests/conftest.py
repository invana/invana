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

# Labels and relationship types created exclusively by schema tests.
# Cleanup is scoped to these to avoid touching other datasets in the DB.
_TEST_NODE_LABELS = ["Person", "Company", "User", "Article", "Doc", "Employee", "Product"]
_TEST_REL_TYPES = ["KNOWS"]


@pytest.fixture
async def connector():
    """Provides a connected Neo4jConnector and cleans up schema-test data after each test."""
    conn = Neo4jConnector(
        NEO4J_URI,
        username=NEO4J_USERNAME,
        password=NEO4J_PASSWORD,
        database=NEO4J_DATABASE,
    )
    await conn.connect()
    yield conn
    # Drop user-created constraints first (they have backing indexes)
    with contextlib.suppress(Exception):
        constraints = await conn.execute("SHOW CONSTRAINTS YIELD name RETURN name")
        for cst in constraints:
            with contextlib.suppress(Exception):
                await conn.execute(f"DROP CONSTRAINT `{cst['name']}` IF EXISTS")
    # Drop user-created indexes (skip LOOKUP indexes which are system-managed)
    with contextlib.suppress(Exception):
        indexes = await conn.execute("SHOW INDEXES YIELD name, type WHERE type <> 'LOOKUP' RETURN name")
        for idx in indexes:
            with contextlib.suppress(Exception):
                await conn.execute(f"DROP INDEX `{idx['name']}` IF EXISTS")
    # Delete only nodes belonging to test-specific labels to avoid touching other datasets
    for label in _TEST_NODE_LABELS:
        with contextlib.suppress(Exception):
            await conn.execute(f"MATCH (n:`{label}`) DETACH DELETE n")
    # Drop any leftover GDS projections
    with contextlib.suppress(Exception):
        projections = await conn.execute("CALL gds.graph.list() YIELD graphName RETURN graphName")
        for proj in projections:
            with contextlib.suppress(Exception):
                await conn.execute("CALL gds.graph.drop($name)", {"name": proj["graphName"]})
    await conn.disconnect()


@pytest.fixture
async def gds_available(connector):
    """Skip the test if GDS plugin is not installed."""
    try:
        await connector.execute("RETURN gds.version() AS version")
    except Exception:
        pytest.skip("Neo4j GDS plugin not available")
