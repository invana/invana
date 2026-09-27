"""Reconnect backoff: a Graph that stays down is retried less and less often.

A real connection row in an isolated Postgres schema, pointed at a port nothing
listens on, so every connect genuinely fails. Only ``asyncio.sleep`` is replaced,
to record the delays the retry loop asks for instead of waiting them out.
"""

from __future__ import annotations

import asyncio

from invana.apps.graphs.pool import ConnectionPool
from invana.apps.graphs.schemas import GraphConnectionCreate
from tests.graphs.conftest import TEST_ENCRYPTION_KEY

UNREACHABLE = GraphConnectionCreate(
    uri="bolt://127.0.0.1:1",
    connector_class="invana_neo4j.connector.Neo4jConnector",
    auth={"username": "neo4j", "password": "password"},
    read_only=False,
)


async def _down_connection(session, store):
    connection = await store.create(session, data=UNREACHABLE, encryption_key=TEST_ENCRYPTION_KEY)
    await session.commit()
    return connection


async def test_each_failed_retry_waits_twice_as_long(session_factory, session, store, monkeypatch):
    connection = await _down_connection(session, store)
    pool = ConnectionPool(session_factory, TEST_ENCRYPTION_KEY)
    delays: list[float] = []

    async def record(delay: float) -> None:
        delays.append(delay)
        if len(delays) > 3:
            raise asyncio.CancelledError  # the loop's own way out, as on deregister

    monkeypatch.setattr(asyncio, "sleep", record)
    await pool._backoff_retry(connection)

    assert delays == [1, 2, 4, 8]
    assert connection.id not in pool._retry_tasks


async def test_a_failed_attempt_inside_the_retry_starts_no_second_retry(session_factory, session, store):
    connection = await _down_connection(session, store)
    pool = ConnectionPool(session_factory, TEST_ENCRYPTION_KEY)

    await pool._connect_graph(connection, retry=False)
    assert connection.id not in pool._retry_tasks

    await pool._connect_graph(connection)  # a first connect that fails does start one
    task = pool._retry_tasks.pop(connection.id)
    task.cancel()
