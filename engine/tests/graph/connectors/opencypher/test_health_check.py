"""The health check goes through the named database, not just the server.

A connection names which database on the server it reads
(docs/for-developers/modules/connect-and-model/features/connect-a-database.md CD8), and Test gates
Save (CD2). ``verify_connectivity()`` alone is not bound to a database, so a
misspelt name used to pass Test, unlock Save, and fail every query afterwards.

Neo4j only: a **named** database is what CD8 is about, and Memgraph community
has no second one to misspell. These build their own connectors and write
nothing — the shared ``connector`` fixture deletes every node on teardown.
"""

from __future__ import annotations

import pytest

from invana.graph.connectors.base.exceptions import ConnectionError
from tests.graph.connectors.backends import NEO4J

pytestmark = pytest.mark.skipif(not NEO4J.is_up(), reason=f"no neo4j ({NEO4J.compose})")


async def test_connects_to_a_database_that_exists():
    conn = NEO4J.connector()
    await conn.connect()
    try:
        assert await conn.health_check() is True
    finally:
        await conn.disconnect()


async def test_a_database_that_does_not_exist_fails_the_connect():
    conn = NEO4J.connector(database="no-such-database")
    with pytest.raises(ConnectionError, match="health check failed"):
        await conn.connect()
