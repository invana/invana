"""HTTP route tests for the Sessions API (RFC-024) against a real Postgres.

These exercise routing, dependency wiring, serialization, and status codes for
the non-execution behaviors (CRUD + the natural-language path, which doesn't
touch a graph DB). The auth / membership / setup-complete gates are overridden
here — they're covered by their own tests — so this isolates the session
routes. The `ql` execution path (`POST /messages` running real Cypher/Gremlin)
needs a live graph DB and is covered by the integration suite.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.graphs.deps import (
    require_graph_member,
    require_graph_setup_complete,
    resolve_graph_by_username_slug,
)
from invana.graphs.models import Graph
from invana.server.app import create_app

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/u/test/g/sessions"


@pytest_asyncio.fixture
async def client(session_factory):
    """App wired to the test Postgres schema with auth/graph gates overridden."""
    async with session_factory() as s:
        user = User(
            email=f"{uuid.uuid4().hex[:8]}@e.com",
            username=f"u_{uuid.uuid4().hex[:8]}",
            password_hash="x",
            first_name="T",
        )
        s.add(user)
        await s.flush()
        graph = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="G", created_by_id=user.id)
        s.add(graph)
        await s.flush()
        await s.commit()
        user_id, graph_id = user.id, graph.id

    # Detached instances are fine — the routes only read scalar columns (.id).
    async with session_factory() as s:
        user = await s.get(User, user_id)
        graph = await s.get(Graph, graph_id)

    app = create_app()
    app.state.graph_connection_manager = object()  # never called on CRUD / nl routes

    async def _override_session():
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_graph_member] = lambda: None
    app.dependency_overrides[resolve_graph_by_username_slug] = lambda: graph
    app.dependency_overrides[require_graph_setup_complete] = lambda: graph

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestSessionsRoutes:
    async def test_create_list_get_lifecycle(self, client):
        # Create an empty session.
        resp = await client.post(BASE, json={})
        assert resp.status_code == 201
        sid = resp.json()["id"]
        assert resp.json()["messages"] == []

        # Send a natural-language message — recorded, not executed.
        resp = await client.post(f"{BASE}/{sid}/messages", json={"content": "hi", "mode": "nl"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["result"] is None
        assert body["user_message"]["role"] == "user"
        assert body["assistant_message"]["role"] == "assistant"

        # List shows the session.
        resp = await client.get(BASE)
        assert resp.status_code == 200
        listing = resp.json()
        assert listing["total"] == 1
        assert listing["items"][0]["id"] == sid

        # Detail carries both messages, ordered.
        resp = await client.get(f"{BASE}/{sid}")
        assert resp.status_code == 200
        msgs = resp.json()["messages"]
        assert [m["seq"] for m in msgs] == [1, 2]

    async def test_rename(self, client):
        sid = (await client.post(BASE, json={})).json()["id"]
        resp = await client.patch(f"{BASE}/{sid}", json={"title": "renamed"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "renamed"

    async def test_delete_then_404(self, client):
        sid = (await client.post(BASE, json={})).json()["id"]
        assert (await client.delete(f"{BASE}/{sid}")).status_code == 204
        assert (await client.get(f"{BASE}/{sid}")).status_code == 404

    async def test_get_missing_is_404(self, client):
        assert (await client.get(f"{BASE}/nope")).status_code == 404
