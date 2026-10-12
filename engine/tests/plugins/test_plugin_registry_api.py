"""`/api/v1/plugins` and `/api/v1/task-types` — the registry, and switching a tool plugin
(docs/for-developers/modules/platform/features/tool-plugins.md).

Real Postgres, no mocks. Only `get_current_user` is overridden — auth has its
own tests — and swapped between an install Admin and a plain user, so what is
under test is the wiring, the manager's refusals and the shape on the wire.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# Every model the admin shows, so `create_all` can resolve every foreign key.
import invana.server.admin.views  # noqa: F401
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.app import create_app
from tests.sessions.conftest import db_engine  # noqa: F401 — the isolated-schema Postgres fixture

pytestmark = pytest.mark.asyncio

WEB = "invana.tools.web"


def _user(*, admin: bool) -> User:
    tag = uuid.uuid4().hex[:8]
    return User(email=f"{tag}@example.com", username=f"u_{tag}", password_hash="x", first_name="U", is_superuser=admin)


@pytest_asyncio.fixture
async def api(db_engine):  # noqa: F811
    """A client, and a dict whose ``"as"`` names who the next request is from."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        admin, member = _user(admin=True), _user(admin=False)
        s.add_all([admin, member])
        await s.commit()

    who = {"as": member}
    app = create_app()
    app.state.db_session_factory = factory

    async def _session():
        async with factory() as sess:
            yield sess
            await sess.commit()

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_current_user] = lambda: who["as"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, who, admin


class TestPluginRegistry:
    async def test_list_names_every_kind_and_only_tool_plugins_switch(self, api):
        client, _, _ = api
        resp = await client.get("/api/v1/plugins")

        assert resp.status_code == 200
        items = {p["name"]: p for p in resp.json()["items"]}
        assert {p["kind"] for p in items.values()} >= {"core", "simulator", "tool"}
        assert items["invana.core.graph_read"]["enabled"] is True
        assert items["invana.core.graph_read"]["switchable"] is False
        assert items[WEB]["switchable"] is True
        assert items[WEB]["enabled"] is False

        detail = (await client.get(f"/api/v1/plugins/{WEB}")).json()
        assert any(t["key"] == "web.fetch" for t in detail["task_types"])

    async def test_an_admin_switches_a_tool_plugin_and_no_one_else_may(self, api):
        client, who, admin = api

        refused = await client.post(f"/api/v1/plugins/{WEB}/enable")
        assert refused.status_code == 403

        who["as"] = admin
        on = await client.post(f"/api/v1/plugins/{WEB}/enable")
        assert on.status_code == 200
        assert on.json()["enabled"] is True
        off = await client.post(f"/api/v1/plugins/{WEB}/disable")
        assert off.json()["enabled"] is False

        assert (await client.post("/api/v1/plugins/invana.core.graph_read/enable")).status_code == 409
        assert (await client.post("/api/v1/plugins/invana.tools.nope/enable")).status_code == 404
        assert (await client.get("/api/v1/plugins/invana.tools.nope")).status_code == 404

    async def test_a_task_type_by_ref_carries_its_plugin_and_usage(self, api):
        client, _, _ = api
        resp = await client.get("/api/v1/task-types/execute_graph_query@1.0.0")

        assert resp.status_code == 200
        body = resp.json()
        assert body["key"] == "execute_graph_query"
        assert body["plugin"].startswith("invana.core.graph_read@")
        assert body["runs_30d"] == 0
        assert (await client.get("/api/v1/task-types/no_such_task")).status_code == 404
