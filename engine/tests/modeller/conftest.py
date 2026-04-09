"""Shared fixtures for schema tests."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.modeller.models import Base
from invana.modeller.store import SchemaStore


@pytest_asyncio.fixture
async def db_engine():
    """Create an in-memory SQLite async engine with tables."""
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
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
