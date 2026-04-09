"""Shared fixtures for schema tests."""

import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.modeller.models import Base
from invana.modeller.store import SchemaStore

TEST_DATABASE_URL = os.environ.get(
    "INVANA_DATABASE_URL",
    "postgresql+asyncpg://invana:testpassword@localhost:15432/invana",
)


@pytest_asyncio.fixture
async def db_engine():
    """Create a PostgreSQL async engine with isolated schema per test session."""
    schema = f"test_{uuid.uuid4().hex[:8]}"
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create an isolated schema for this test session
    async with engine.begin() as conn:
        await conn.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {schema}")
    await engine.dispose()

    # Engine with search path set to the test schema
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        execution_options={"schema_translate_map": {None: schema}},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup: drop the test schema
    cleanup_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with cleanup_engine.begin() as conn:
        await conn.exec_driver_sql(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
    await cleanup_engine.dispose()
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine):
    """Return a session factory bound to the test engine."""
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def session(session_factory):
    """Provide a single async session, rolled back after the test."""
    async with session_factory() as sess:
        yield sess
        await sess.rollback()


@pytest.fixture
def store():
    """Return a SchemaStore instance."""
    return SchemaStore()
