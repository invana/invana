"""Shared fixtures for graphs tests — isolated Postgres schema, real DB (no mocks)."""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import every model whose table the FKs touch so `create_all` builds them —
# plus the four apps `SetupManager.derive_setup_state` reads, since every Graph
# read now derives its setup state.
from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.graphs.models import Graph
from invana.apps.graphs.querysets import GraphConnectionQuerySet
from invana.apps.graphs.schemas import GraphConnectionCreate
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.modeller.models import GraphModel, GraphVersion, NodeTypeDefinition  # noqa: F401
from invana.apps.sessions.models import Session  # noqa: F401 — task_runs points at it
from invana.apps.skills.models import Skill  # noqa: F401
from invana.apps.task_plans.models import TaskPlan  # noqa: F401
from invana.apps.work.models import Task  # noqa: F401 — todos, which task_plans points at
from invana.core.auth.models import User
from invana.core.events.models import Event  # noqa: F401
from invana.core.models import Base
from invana.core.settings import settings
from invana.runtime.models import TaskRun  # noqa: F401

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


@pytest_asyncio.fixture
async def user(session: AsyncSession) -> User:
    suffix = uuid.uuid4().hex[:8]
    u = User(email=f"{suffix}@example.com", username=f"u_{suffix}", password_hash="x", first_name="T")
    session.add(u)
    await session.flush()
    return u


@pytest_asyncio.fixture
async def graph(session: AsyncSession, user: User) -> Graph:
    g = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="Test Graph", created_by_id=user.id)
    session.add(g)
    await session.flush()
    return g


@pytest.fixture
def store():
    return GraphConnectionQuerySet()


@pytest.fixture
def connection_create_data() -> GraphConnectionCreate:
    return GraphConnectionCreate(
        uri="bolt://localhost:7687",
        connector_class=TEST_CONNECTOR_CLASS,
        auth={"username": "neo4j", "password": "password"},
        read_only=False,
    )
