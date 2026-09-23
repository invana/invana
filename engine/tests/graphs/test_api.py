"""HTTP route tests for the Graph container and its connection sub-resource
(docs/for-developers/modules/identity-and-access/spec.md) against a real Postgres.

Auth is overridden with a real ``User`` row; the slug resolver and the
membership gate are left real so the URL contract ``/u/{username}/{graphSlug}``
is exercised end to end. The connection manager is mocked — connecting to a
graph database is covered by the integration suite.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.app import create_app
from tests.graphs.conftest import TEST_CONNECTOR_CLASS

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_manager():
    """A GraphConnectionManager stand-in that records calls and does nothing."""
    manager = MagicMock()
    manager.startup = AsyncMock()
    manager.shutdown = AsyncMock()
    manager.register = AsyncMock()
    manager.deregister = AsyncMock()
    manager.reconnect = AsyncMock()
    return manager


@pytest_asyncio.fixture
async def owner(session_factory) -> User:
    async with session_factory() as s:
        suffix = uuid.uuid4().hex[:8]
        user = User(email=f"{suffix}@example.com", username=f"u_{suffix}", password_hash="x", first_name="T")
        s.add(user)
        await s.commit()
        user_id = user.id
    async with session_factory() as s:
        return await s.get(User, user_id)


@pytest_asyncio.fixture
async def client(session_factory, owner, mock_manager):
    """App wired to the test Postgres schema, authenticated as ``owner``."""
    app = create_app()
    # Lifespan doesn't run under ASGITransport — wire what the routes read off app.state.
    app.state.db_session_factory = session_factory
    app.state.graph_connection_manager = mock_manager

    async def _override_session():
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = lambda: owner

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _create_graph(client: AsyncClient, slug: str) -> dict:
    resp = await client.post("/api/v1/graphs", json={"name": "My Graph", "slug": slug})
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestGraphsAPI:
    async def test_create_graph_makes_owner_a_member(self, client, owner):
        body = await _create_graph(client, "my-graph")
        assert body["slug"] == "my-graph"
        assert body["name"] == "My Graph"

        # The creator can reach the graph through the real membership gate.
        resp = await client.get(f"/api/v1/u/{owner.username}/my-graph")
        assert resp.status_code == 200
        assert resp.json()["id"] == body["id"]

    async def test_create_graph_duplicate_slug_conflicts(self, client):
        await _create_graph(client, "dup")
        resp = await client.post("/api/v1/graphs", json={"name": "Again", "slug": "dup"})
        assert resp.status_code == 409

    async def test_list_graphs(self, client):
        await _create_graph(client, "listed")
        resp = await client.get("/api/v1/graphs")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert "listed" in [g["slug"] for g in body["items"]]

    async def test_every_graph_read_derives_setup_state(self, client, owner, session_factory):
        """A read serves the **derived** state, not the stored column.

        The stored column only ever holds skips and the instructions stamp, so a
        read that served it left `providers` absent — and Studio kept asking for a
        provider that was already configured and pinged.
        """
        graph = await _create_graph(client, "derived")
        async with session_factory() as s:
            # One endpoint offering one model: with no cast authored, that is
            # what the shipped cast resolves and what the gate reads (PM16).
            provider = LLMProvider(
                graph_id=graph["id"],
                name="anthropic",
                provider=LLMProviderKind.anthropic,
                api_key_encrypted=b"x",
                guardrails={},
                last_ping_at=datetime.now(UTC),
                last_ping_ok=True,
            )
            s.add(provider)
            await s.flush()
            s.add(LLMModel(provider_id=provider.id, model_id="claude-opus-5", capabilities={}, pricing={}))
            await s.commit()

        detail = (await client.get(f"/api/v1/u/{owner.username}/derived")).json()
        assert detail["setup_state"]["providers"]["done"] is True

        listed = (await client.get("/api/v1/graphs")).json()["items"]
        row = next(g for g in listed if g["slug"] == "derived")
        assert row["setup_state"]["providers"]["done"] is True

        patched = (await client.patch(f"/api/v1/u/{owner.username}/derived", json={"description": "d"})).json()["data"]
        assert patched["setup_state"]["providers"]["done"] is True

    async def test_a_graph_without_a_provider_still_reports_the_section(self, client, owner):
        """The negative half: `done` is False, and the section is *present* — a
        missing key and a false one read the same to a client, which is how the
        bug hid."""
        await _create_graph(client, "bare")
        state = (await client.get(f"/api/v1/u/{owner.username}/bare")).json()["setup_state"]
        assert state["providers"] == {
            "done": False,
            "completed_at": None,
            "skipped_at": None,
            "required": True,
            "gate": "answering",
            "blocked_by": None,
            "broken": None,
        }

    async def test_get_graph_not_found(self, client, owner):
        resp = await client.get(f"/api/v1/u/{owner.username}/nonexistent")
        assert resp.status_code == 404

    async def test_delete_graph(self, client, owner):
        await _create_graph(client, "del-me")
        resp = await client.delete(f"/api/v1/u/{owner.username}/del-me")
        assert resp.status_code == 204

        resp = await client.get(f"/api/v1/u/{owner.username}/del-me")
        assert resp.status_code == 404

    async def test_put_connection_registers_with_manager(self, client, owner, mock_manager):
        await _create_graph(client, "conn")
        payload = {
            "uri": "bolt://localhost:7687",
            "connector_class": TEST_CONNECTOR_CLASS,
            "auth": {"username": "neo4j", "password": "secret"},
        }
        resp = await client.put(f"/api/v1/u/{owner.username}/conn/connection", json=payload)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["connector_class"] == TEST_CONNECTOR_CLASS
        assert data["status"] == "CONNECTING"
        assert "auth_encrypted" not in data
        mock_manager.register.assert_awaited_once()
