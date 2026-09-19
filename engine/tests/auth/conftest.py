"""Shared fixtures for auth tests — isolated PostgreSQL schema per test session."""

import uuid

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import every model module so they register on the shared Base.metadata before
# create_all — provision_user/admin_set_password touch users + events tables.
from invana.core.models import Base
from invana.core.settings import settings


@pytest_asyncio.fixture
async def db_engine():
    schema = f"test_auth_{uuid.uuid4().hex[:8]}"
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
async def session(db_engine):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as sess:
        yield sess
        await sess.rollback()


@pytest_asyncio.fixture
async def session_factory(db_engine):
    """A factory bound to the same isolated schema — route tests open their own sessions."""
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
