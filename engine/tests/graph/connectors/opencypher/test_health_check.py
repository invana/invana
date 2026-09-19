"""The health check goes through the named database, not just the server.

A connection names which database on the server it reads
(docs/for-developers/modules/connect-and-model/features/connect-a-database.md CD8), and Test gates
Save (CD2). ``verify_connectivity()`` alone is not bound to a database, so a
misspelt name used to pass Test, unlock Save, and fail every query afterwards.

These build their own connectors and write nothing — the shared ``connector``
fixture in this package deletes every node on teardown.
"""

from __future__ import annotations

import pytest

from invana.graph.connectors.base.exceptions import ConnectionError
from invana.graph.connectors.cypher.connector import OpenCypherConnector

from .conftest import NEO4J_DATABASE, NEO4J_PASSWORD, NEO4J_URI, NEO4J_USERNAME


def _connector(database: str) -> OpenCypherConnector:
    return OpenCypherConnector(
        NEO4J_URI,
        username=NEO4J_USERNAME,
        password=NEO4J_PASSWORD,
        database=database,
    )


async def test_connects_to_a_database_that_exists():
    conn = _connector(NEO4J_DATABASE)
    await conn.connect()
    try:
        assert await conn.health_check() is True
    finally:
        await conn.disconnect()


async def test_a_database_that_does_not_exist_fails_the_connect():
    conn = _connector("no-such-database")
    with pytest.raises(ConnectionError, match="health check failed"):
        await conn.connect()
