"""Shared fixtures for Gremlin connector integration tests.

Uses ArcadeDB as the primary Gremlin test backend.
Requires: docker compose --profile arcadedb up -d

Override with environment variables:
  GREMLIN_URI       (default: ws://localhost:18182/gremlin)
  GREMLIN_USERNAME  (default: root)
  GREMLIN_PASSWORD  (default: testpassword)
  GREMLIN_TEST_DB   (default: arcadedb) — set to "janusgraph" to test JanusGraph
"""

from __future__ import annotations

import os
import socket
from urllib.parse import urlparse

import pytest

from invana.graph.connectors.gremlin.connector import GremlinConnector

GREMLIN_URI = os.environ.get("GREMLIN_URI", "ws://localhost:18182/gremlin")
GREMLIN_USERNAME = os.environ.get("GREMLIN_USERNAME", "root")
GREMLIN_PASSWORD = os.environ.get("GREMLIN_PASSWORD", "testpassword")
GREMLIN_TEST_DB = os.environ.get("GREMLIN_TEST_DB", "arcadedb")


def _gremlin_up() -> bool:
    """Is a Gremlin server listening? Mirrors the Ollama gate in tests/llm.

    Without it the whole suite errors on a checkout that has not started
    ArcadeDB, and a real regression is indistinguishable from a missing
    container.
    """
    parsed = urlparse(GREMLIN_URI)
    if parsed.hostname is None:
        return False
    try:
        with socket.create_connection((parsed.hostname, parsed.port or 8182), timeout=2):
            return True
    except OSError:
        return False


@pytest.fixture
async def connector():
    """Provide a connected Gremlin connector and clean up after each test."""
    if not _gremlin_up():
        pytest.skip(f"no Gremlin server at {GREMLIN_URI} (docker compose --profile arcadedb up -d)")
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
