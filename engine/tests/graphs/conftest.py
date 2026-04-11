"""Shared fixtures for graphs tests."""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.graphs.schemas import GraphCreate
from invana.graphs.store import GraphModelStore
from invana.modeller.models import Base
from invana.settings import settings

TEST_ENCRYPTION_KEY = "Ry3OxpZmI9Rv1gv3T2kD1n0jY4EeKaLZwH-cFCG9hMA="
TEST_CONNECTOR_CLASS = "invana.graph.connectors.neo4j.connector.Neo4jConnector"


@pytest_asyncio.fixture
async def db_engine():
    """Create a PostgreSQL async engine with isolated schema per test session."""
    schema = f"test_graphs_{uuid.uuid4().hex[:8]}"
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

    cleanup_engine = create_async_engine(settings.database_url, echo=False)
    async with cleanup_engine.begin() as conn:
        await conn.exec_driver_sql(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
    await cleanup_engine.dispose()
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def session(session_factory):
    async with session_factory() as sess:
        yield sess
        await sess.rollback()


@pytest.fixture
def store():
    return GraphModelStore()


@pytest.fixture
def graph_create_data() -> GraphCreate:
    return GraphCreate(
        name="Test Graph",
        description="A test graph connection",
        uri="bolt://localhost:7687",
        connector_class=TEST_CONNECTOR_CLASS,
        auth={"username": "neo4j", "password": "password"},
        read_only=False,
    )
