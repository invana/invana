"""Workers fixtures — an isolated Postgres schema for the app tables, procrastinate's own tables as they are.

Auth is overridden for the people routes only (a real superuser or member row);
the worker routes authenticate themselves, exactly as in production. Each test
works on a label of its own, so the jobs it queues are never leased by another
test or by a developer's real worker, and it removes them when it ends.
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.flows.models import Flow  # noqa: F401
from invana.apps.iam.models import Policy  # noqa: F401
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.modeller.models import GraphModel  # noqa: F401
from invana.apps.sessions.models import Session  # noqa: F401
from invana.apps.skills.models import Skill  # noqa: F401
from invana.apps.work.models import Task  # noqa: F401
from invana.apps.workers.models import Worker  # noqa: F401
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.events.models import Event  # noqa: F401
from invana.core.ledger import models as _ledger  # noqa: F401
from invana.core.models import Base
from invana.core.settings import settings
from invana.plugins import gateway, queue
from invana.runtime.models import TaskRun  # noqa: F401
from invana.server.app import create_app


@pytest_asyncio.fixture
async def queue_ready(monkeypatch):
    """procrastinate's schema applied, the executor switched on, the queue closed again afterwards."""
    monkeypatch.setattr(settings, "executor", "procrastinate")
    monkeypatch.setattr(gateway, "LEASE_WAIT_S", 1)
    await queue.apply_schema()
    yield
    await queue.close()
    queue._app = None


@pytest_asyncio.fixture
async def label(queue_ready):
    """A label no other test or real worker uses, and its jobs removed at the end."""
    name = f"t{uuid.uuid4().hex[:8]}"
    yield name
    admin = create_async_engine(settings.database_url)
    async with admin.begin() as conn:
        await conn.execute(text("DELETE FROM procrastinate_jobs WHERE queue_name = :q"), {"q": f"tools.{name}"})
    await admin.dispose()


@pytest_asyncio.fixture
async def session_factory():
    schema = f"test_workers_{uuid.uuid4().hex[:8]}"
    admin = create_async_engine(settings.database_url)
    async with admin.begin() as conn:
        await conn.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {schema}")
    engine = create_async_engine(settings.database_url, execution_options={"schema_translate_map": {None: schema}})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()
    async with admin.begin() as conn:
        await conn.exec_driver_sql(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
    await admin.dispose()


async def _user(session_factory, name: str, *, admin: bool) -> User:
    async with session_factory() as s:
        suffix = uuid.uuid4().hex[:8]
        user = User(
            email=f"{name}{suffix}@example.com",
            username=f"{name}{suffix}",
            password_hash="x",
            first_name=name,
            is_superuser=admin,
        )
        s.add(user)
        await s.commit()
        return user


@pytest_asyncio.fixture
async def people(session_factory) -> dict[str, User]:
    return {
        "admin": await _user(session_factory, "root", admin=True),
        "member": await _user(session_factory, "bo", admin=False),
    }


@pytest_asyncio.fixture
async def app(session_factory):
    built = create_app()
    built.state.db_session_factory = session_factory
    return built


@pytest_asyncio.fixture
async def client(app, people):
    """The app with the people routes signed in; ``client.as_(user)`` switches who is asking."""
    who = {"user": people["admin"]}
    app.dependency_overrides[get_current_user] = lambda: who["user"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        c.as_ = lambda user: who.__setitem__("user", user)
        yield c
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def anonymous(app):
    """The same app with real auth — what a worker, or a stray join token, meets."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
