"""Shared fixtures for OpenCypher connector integration tests.

Uses Neo4j as the test backend for standard openCypher operations.
Requires: docker compose -f docker-compose-infra.yml up -d

Override with environment variables: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE
"""

from __future__ import annotations

import os

import pytest

from invana.graph.connectors.cypher.connector import OpenCypherConnector

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "testpassword")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")


@pytest.fixture
async def connector():
    """Provides a connected OpenCypher connector and cleans up after each test."""
    conn = OpenCypherConnector(
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
