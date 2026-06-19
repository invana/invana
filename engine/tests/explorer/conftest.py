"""Fixtures for Explorer expand tests — real Postgres + a real Neo4j connector.

Wires a live ``OpenCypherConnector`` into a real ``GraphConnectionManager``
registry (keyed by the GraphConnection id, exactly as the routes resolve it)
so the service runs end-to-end against a real graph DB (no mocks, rule #7).

Requires: docker compose -f docker-compose-infra.yml up -d   (Neo4j + Postgres)
"""

from __future__ import annotations

import os
import uuid

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.auth.models import User
from invana.events.models import Event  # noqa: F401 — table needed for emit_event
from invana.graph.connectors.cypher.connector import OpenCypherConnector
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph, GraphConnection
from invana.modeller.models import Base
from invana.settings import settings

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "testpassword")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")


@pytest_asyncio.fixture
async def db_engine():
    schema = f"test_explorer_{uuid.uuid4().hex[:8]}"
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {schema}")
    await engine.dispose()

    engine = create_async_engine(
        settings.database_url,
        echo=False,
        execution_options={"schema_translate_map": {None: schema}},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    cleanup = create_async_engine(settings.database_url, echo=False)
    async with cleanup.begin() as conn:
        await conn.exec_driver_sql(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
    await cleanup.dispose()
    await engine.dispose()


@pytest_asyncio.fixture
async def session(db_engine):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as sess:
        yield sess
        await sess.rollback()


@pytest_asyncio.fixture
async def user(session: AsyncSession) -> User:
    suffix = uuid.uuid4().hex[:8]
    u = User(email=f"{suffix}@example.com", username=f"user_{suffix}", password_hash="x", first_name="Test")
    session.add(u)
    await session.flush()
    return u


@pytest_asyncio.fixture
async def connector():
    conn = OpenCypherConnector(NEO4J_URI, username=NEO4J_USERNAME, password=NEO4J_PASSWORD, database=NEO4J_DATABASE)
    await conn.connect()
    yield conn
    await conn.execute("MATCH (n) DETACH DELETE n")
    await conn.disconnect()


@pytest_asyncio.fixture
async def graph(session: AsyncSession, user: User, connector) -> Graph:
    """A setup-complete graph whose live connector is registered in the manager."""
    g = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="Test Graph", created_by_id=user.id)
    session.add(g)
    await session.flush()
    conn_row = GraphConnection(
        graph_id=g.id,
        uri=NEO4J_URI,
        connector_class="invana.graph.connectors.cypher.connector.OpenCypherConnector",
    )
    session.add(conn_row)
    await session.flush()
    g._connection_id = conn_row.id  # stash for the manager fixture
    return g


@pytest_asyncio.fixture
async def manager(graph, connector) -> GraphConnectionManager:
    mgr = GraphConnectionManager(session_factory=None, encryption_key=settings.encryption_key)
    mgr._registry[graph._connection_id] = connector
    return mgr


@pytest_asyncio.fixture
async def seeded_graph(connector):
    alice = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30, "city": "NYC"})
    bob = await connector.data_writer.create_vertex("Person", {"name": "Bob", "age": 25, "city": "LA"})
    charlie = await connector.data_writer.create_vertex("Person", {"name": "Charlie", "age": 35, "city": "NYC"})
    acme = await connector.data_writer.create_vertex("Company", {"name": "Acme Corp"})
    await connector.data_writer.create_edge("KNOWS", alice.id, bob.id, {"since": 2020})
    await connector.data_writer.create_edge("KNOWS", alice.id, charlie.id, {"since": 2018})
    await connector.data_writer.create_edge("WORKS_AT", alice.id, acme.id, {"role": "Engineer"})
    return {"alice": alice, "bob": bob, "charlie": charlie, "acme": acme}
