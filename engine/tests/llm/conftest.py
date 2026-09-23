"""Fixtures for the LLM suite — isolated Postgres schema, real DB (no mocks).

Most of this suite reaches a live Ollama and needs none of these; the provider
rules need a database, and this is the same shape every other suite uses.
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Every model whose table the FKs touch, so `create_all` builds them.
from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.boards.models import Board  # noqa: F401
from invana.apps.govern.models import Lens, RunTouch  # noqa: F401
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.modeller.models import GraphModel  # noqa: F401
from invana.apps.sessions.models import Session  # noqa: F401
from invana.apps.skills.models import Skill  # noqa: F401
from invana.apps.task_plans.models import Task as PlanTask  # noqa: F401
from invana.apps.task_plans.models import TaskPlan  # noqa: F401
from invana.apps.work.models import (
    Project,  # noqa: F401
    Task,  # noqa: F401
)
from invana.core.auth.models import User
from invana.core.events.models import Event  # noqa: F401
from invana.core.models import Base
from invana.core.settings import settings
from invana.runtime.models import TaskRun  # noqa: F401


@pytest_asyncio.fixture
async def db_engine():
    schema = f"test_llm_{uuid.uuid4().hex[:8]}"
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
    row = User(email="owner@example.com", username="owner", password_hash="x", first_name="Owner")
    session.add(row)
    await session.flush()
    return row


@pytest_asyncio.fixture
async def graph(session: AsyncSession, user: User) -> Graph:
    row = Graph(slug="atlas", name="Atlas", created_by_id=user.id, setup_state={})
    session.add(row)
    await session.flush()
    return row


@pytest_asyncio.fixture
async def member(session: AsyncSession, graph: Graph, user: User) -> GraphMember:
    """The Graph's owner, holding the guardrail permission.

    Migration 49 backfills the owner as the first holder, so a Graph never has
    nobody who may edit its bounds (GV22). The fixture mirrors that.
    """
    row = GraphMember(graph_id=graph.id, user_id=user.id, can_edit_guardrails=True)
    session.add(row)
    await session.flush()
    return row
