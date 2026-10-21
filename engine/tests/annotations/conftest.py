"""Fixtures for annotation tests — isolated Postgres schema, real DB (no mocks).

Annotations live in the app DB only; these tests never touch a graph database.
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import every model whose table the FKs touch so `create_all` builds them.
# The migration environment's list — every table, so every foreign key resolves.
from invana.activity.models import (  # noqa: F401
    Approval,
    Notification,
    NotificationChannel,
    NotificationCursor,
    NotificationDelivery,
    NotificationRule,
    Schedule,
    ScheduleFiring,
)
from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.annotations.models import Annotation, AnnotationAnchor  # noqa: F401
from invana.apps.boards.models import Board, BoardVersion  # noqa: F401
from invana.apps.datasets.models import (  # noqa: F401
    Dataset,
    DatasetBinding,
    DatasetConformance,
    DatasetRecord,
    DatasetStandard,
    DatasetVersion,
)
from invana.apps.graphs.models import (  # noqa: F401
    Graph,
    GraphConnection,
    GraphMember,
)
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.sessions.models import Session, SessionMessage
from invana.apps.skills.models import (
    Rule,  # noqa: F401
    RuleVersion,  # noqa: F401
    Skill,  # noqa: F401
    SkillBinding,  # noqa: F401
    SkillVersion,  # noqa: F401
)
from invana.apps.standards.models import Standard, StandardVersion  # noqa: F401
from invana.apps.task_plans.models import Task as PlanTask  # noqa: F401
from invana.apps.task_plans.models import TaskPlan  # noqa: F401
from invana.apps.work.models import (  # noqa: F401
    Project,
    ProjectAssignment,
    Task,
    TaskDependency,
)

# Import all models so metadata is fully populated for autogenerate.
from invana.core.auth.models import RefreshToken, User  # noqa: F401
from invana.core.events.models import Event  # noqa: F401
from invana.core.models import Base
from invana.core.settings import settings
from invana.runtime.models import (  # noqa: F401
    EvalBudget,
    EvalCase,
    EvalResult,
    EvalSet,
    TaskPrompt,
    TaskRun,
    TaskStream,
)


@pytest_asyncio.fixture
async def db_engine():
    schema = f"test_annotations_{uuid.uuid4().hex[:8]}"
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


@pytest_asyncio.fixture
async def graph_session(session: AsyncSession, graph: Graph, user: User) -> Session:
    """A backing session (the creator's) with one message carrying a source_query."""
    sess = Session(graph_id=graph.id, created_by_id=user.id, title="My session")
    session.add(sess)
    await session.flush()
    msg = SessionMessage(
        session_id=sess.id,
        seq=1,
        role="assistant",
        content="Returned 3 nodes.",
        source_query="MATCH (n) RETURN n LIMIT 3",
    )
    session.add(msg)
    await session.flush()
    return sess
