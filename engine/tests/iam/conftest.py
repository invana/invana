"""IAM fixtures — an isolated Postgres schema and the app on it, signed in as a real user.

Auth is the one override — a real ``User`` row picked per request — so the slug
resolver, the membership gate and the role check run as they do in production.
"""

from __future__ import annotations

import uuid

import pytest_asyncio
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Every model whose table a Graph read or an FK touches, so `create_all` builds them.
from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.flows.models import Flow  # noqa: F401
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.models import Policy  # noqa: F401
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.modeller.models import GraphModel  # noqa: F401
from invana.apps.sessions.models import Session  # noqa: F401
from invana.apps.skills.models import Skill  # noqa: F401
from invana.apps.work.models import Task  # noqa: F401
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.events.models import Event  # noqa: F401
from invana.core.ledger import models as _ledger  # noqa: F401
from invana.core.models import Base
from invana.core.settings import settings
from invana.runtime.models import TaskRun  # noqa: F401
from invana.server.app import create_app
from invana.server.iam.routes import iam_router


@pytest_asyncio.fixture
async def session_factory():
    schema = f"test_iam_{uuid.uuid4().hex[:8]}"
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


async def _user(session_factory, name: str) -> User:
    async with session_factory() as s:
        suffix = uuid.uuid4().hex[:8]
        user = User(email=f"{name}{suffix}@example.com", username=f"{name}{suffix}", password_hash="x", first_name=name)
        s.add(user)
        await s.commit()
        return user


@pytest_asyncio.fixture
async def people(session_factory) -> dict[str, User]:
    return {"ada": await _user(session_factory, "ada"), "bo": await _user(session_factory, "bo")}


@pytest_asyncio.fixture
async def client(session_factory, people):
    """The app on the test schema; ``client.as_(user)`` switches who is asking."""
    app = create_app()
    if not any(isinstance(r, APIRoute) and r.path.startswith(iam_router.prefix) for r in app.routes):
        app.include_router(iam_router)
    app.state.db_session_factory = session_factory
    who = {"user": people["ada"]}
    app.dependency_overrides[get_current_user] = lambda: who["user"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        c.as_ = lambda user: who.__setitem__("user", user)
        yield c


@pytest_asyncio.fixture
async def graph_url(client, people, session_factory) -> str:
    """A Graph ada created, with its six managed policies written."""
    slug = f"atlas-{uuid.uuid4().hex[:6]}"
    resp = await client.post("/api/v1/graphs", json={"name": "Atlas Routes", "slug": slug})
    assert resp.status_code == 201, resp.text
    async with session_factory() as s:
        await PolicyManager().ensure_managed(s, graph_id=resp.json()["id"])
        await s.commit()
    return f"/api/v1/u/{people['ada'].username}/{slug}"
