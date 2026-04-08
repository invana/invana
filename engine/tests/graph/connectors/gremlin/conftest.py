"""Shared fixtures for Gremlin connector integration tests.

Uses ArcadeDB as the primary Gremlin test backend.
Requires: docker compose -f docker-compose-infra.yml up -d arcadedb

Override with environment variables:
  GREMLIN_URI       (default: ws://localhost:18182/gremlin)
  GREMLIN_USERNAME  (default: root)
  GREMLIN_PASSWORD  (default: testpassword)
  GREMLIN_TEST_DB   (default: arcadedb) — set to "janusgraph" to test JanusGraph
"""

from __future__ import annotations

import os

import pytest

from invana.graph.connectors.gremlin.connector import GremlinConnector

GREMLIN_URI = os.environ.get("GREMLIN_URI", "ws://localhost:18182/gremlin")
GREMLIN_USERNAME = os.environ.get("GREMLIN_USERNAME", "root")
GREMLIN_PASSWORD = os.environ.get("GREMLIN_PASSWORD", "testpassword")
GREMLIN_TEST_DB = os.environ.get("GREMLIN_TEST_DB", "arcadedb")


@pytest.fixture
async def connector():
    """Provide a connected Gremlin connector and clean up after each test."""
    conn = GremlinConnector(
        GREMLIN_URI,
        username=GREMLIN_USERNAME,
        password=GREMLIN_PASSWORD,
    )
    await conn.connect()
    yield conn
    # Clean up all data after each test
    try:
        g = await conn.get_traversal_source()
        await conn.execute_traversal(g.V().drop())
    except Exception:
        pass
    await conn.disconnect()
