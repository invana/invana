"""Shared fixtures for the Gremlin conformance suite.

Every test in this package runs against **each** live Gremlin backend — ArcadeDB
and JanusGraph, both on the core language connector, since neither overrides it
yet. A backend nothing is listening on skips, naming the compose command
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md CC5).
"""

from __future__ import annotations

import pytest

from tests.graph.connectors.backends import GREMLIN_BACKENDS


@pytest.fixture(params=GREMLIN_BACKENDS, ids=lambda b: b.name)
async def backend(request):
    """The backend under test, skipped when its container is not up."""
    if not request.param.is_up():
        pytest.skip(f"no {request.param.name} at {request.param.host}:{request.param.port} ({request.param.compose})")
    return request.param


@pytest.fixture
async def connector(backend):
    """A connected Gremlin connector, with the graph emptied after each test."""
    conn = backend.connector()
    await conn.connect()
    yield conn
    try:
        g = await conn.get_traversal_source()
        await conn.execute_traversal(g.V().drop())
    except Exception:
        pass
    await conn.disconnect()
