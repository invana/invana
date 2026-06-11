"""Fixtures for sessions tests — isolated Postgres schema, real DB (no mocks)."""

from __future__ import annotations

import uuid

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import every model whose table the FKs touch so `create_all` builds them.
from invana.auth.models import User
from invana.events.models import Event  # noqa: F401
from invana.graphs.models import Graph
from invana.modeller.models import Base
from invana.sessions.models import Session, SessionMessage  # noqa: F401
from invana.settings import settings


@pytest_asyncio.fixture
async def db_engine():
    schema = f"test_sessions_{uuid.uuid4().hex[:8]}"
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
async def session_factory(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def session(session_factory):
    async with session_factory() as sess:
        yield sess
        await sess.rollback()


async def _make_user(session: AsyncSession, *, suffix: str) -> User:
    user = User(
        email=f"{suffix}@example.com",
        username=f"user_{suffix}",
        password_hash="x",
        first_name="Test",
    )
    session.add(user)
    await session.flush()
    return user


@pytest_asyncio.fixture
async def user(session: AsyncSession) -> User:
    return await _make_user(session, suffix=uuid.uuid4().hex[:8])


@pytest_asyncio.fixture
async def other_user(session: AsyncSession) -> User:
    return await _make_user(session, suffix=uuid.uuid4().hex[:8])


@pytest_asyncio.fixture
async def graph(session: AsyncSession, user: User) -> Graph:
    g = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="Test Graph", created_by_id=user.id)
    session.add(g)
    await session.flush()
    return g
