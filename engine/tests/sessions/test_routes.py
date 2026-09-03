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
from invana.thinking.runtime import ThinkingRuntime

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
    # Lifespan doesn't run under ASGITransport — wire what the routes read off
    # app.state by hand. The runtime is real: a ql send runs a thinking whose
    # execute step fails (no connector), which is exactly the path we assert.
    app.state.db_session_factory = session_factory
    app.state.thinking_runtime = ThinkingRuntime(
        session_factory=session_factory, manager=app.state.graph_connection_manager, encryption_key="x"
    )

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

        # A natural-language send with no LLM provider configured → 422 with an
        # actionable, backend-owned message (provider resolution; RFC-030). The
        # failure rolls back before any message is written.
        resp = await client.post(f"{BASE}/{sid}/messages", json={"content": "hi", "mode": "nl"})
        assert resp.status_code == 422
        assert "Settings" in resp.json()["detail"]

        # List shows the session.
        resp = await client.get(BASE)
        assert resp.status_code == 200
        listing = resp.json()
        assert listing["total"] == 1
        assert listing["items"][0]["id"] == sid

        # The rejected send left no messages.
        resp = await client.get(f"{BASE}/{sid}")
        assert resp.status_code == 200
        assert resp.json()["messages"] == []

    async def test_rename(self, client):
        sid = (await client.post(BASE, json={})).json()["id"]
        resp = await client.patch(f"{BASE}/{sid}", json={"title": "renamed"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "renamed"

    async def test_pin_and_archive_via_patch(self, client):
        sid = (await client.post(BASE, json={})).json()["id"]

        resp = await client.patch(f"{BASE}/{sid}", json={"pinned": True, "archived": True})
        assert resp.status_code == 200
        assert resp.json()["pinned"] is True and resp.json()["archived"] is True

        # Archived sessions drop out of the default list but return when opted in.
        assert (await client.get(BASE)).json()["total"] == 0
        opted_in = await client.get(BASE, params={"include_archived": "true"})
        assert opted_in.json()["total"] == 1

    async def test_delete_then_404(self, client):
        sid = (await client.post(BASE, json={})).json()["id"]
        assert (await client.delete(f"{BASE}/{sid}")).status_code == 204
        assert (await client.get(f"{BASE}/{sid}")).status_code == 404

    async def test_get_missing_is_404(self, client):
        assert (await client.get(f"{BASE}/nope")).status_code == 404


class TestThinkingRoutes:
    async def test_send_opens_a_thinking_and_the_trace_is_on_the_record(self, client):
        """A ql send returns 202 with a thinking; the run settles in the background
        (the execute step fails here — no graph connection in this harness) and
        the steps are readable on the thinking, on the session detail, and as a
        replayed stream (RFC-055 UC1 · UC4 · UC6 · UC12)."""
        sid = (await client.post(BASE, json={})).json()["id"]
        resp = await client.post(f"{BASE}/{sid}/messages", json={"content": "MATCH (n) RETURN n LIMIT 1", "mode": "ql"})
        assert resp.status_code == 202
        body = resp.json()
        thinking_id = body["thinking_id"]
        assert body["assistant_message"]["status"] == "running"
        assert body["assistant_message"]["thinking_id"] == thinking_id
        assert body["stream_url"].endswith(f"/thinkings/{thinking_id}/stream")

        # Let the background run settle.
        runtime = client._transport.app.state.thinking_runtime
        task = runtime._tasks.get(thinking_id)
        if task is not None:
            await task

        th = (await client.get(f"{BASE.replace('/sessions', '/thinkings')}/{thinking_id}")).json()
        assert th["workflow_key"] == "ql-query"
        assert th["status"] == "failed"
        by_key = {s["task_key"]: s for s in th["steps"]}
        assert by_key["validate_query"]["status"] == "succeeded"
        assert by_key["validate_query"]["detail"].startswith("read-only")
        assert by_key["execute_graph_query"]["status"] == "failed"
        assert by_key["shape_for_canvas"]["status"] == "queued"

        detail = (await client.get(f"{BASE}/{sid}")).json()
        reply = detail["messages"][1]
        assert reply["status"] == "error"
        assert reply["thinking_id"] == thinking_id
        assert [s["label"] for s in reply["steps"]] == ["Validate", "Execute", "Project"]

        kinds: list[str] = []
        async with client.stream("GET", body["stream_url"]) as stream:
            async for line in stream.aiter_lines():
                if line.startswith("event: "):
                    kinds.append(line.removeprefix("event: "))
                if line == "event: thinking.done":
                    break
        assert kinds[0] == "thinking.started"
        assert "step.started" in kinds and "diagnosis" in kinds
        assert kinds[-1] == "thinking.done"

    async def test_send_refuses_a_write_before_running_it(self, client):
        """Validate is a step on the record: a mutating query never reaches execute (UC4)."""
        sid = (await client.post(BASE, json={})).json()["id"]
        resp = await client.post(f"{BASE}/{sid}/messages", json={"content": "MATCH (n) DELETE n", "mode": "ql"})
        thinking_id = resp.json()["thinking_id"]
        runtime = client._transport.app.state.thinking_runtime
        task = runtime._tasks.get(thinking_id)
        if task is not None:
            await task
        th = (await client.get(f"{BASE.replace('/sessions', '/thinkings')}/{thinking_id}")).json()
        by_key = {s["task_key"]: s for s in th["steps"]}
        assert by_key["validate_query"]["status"] == "failed"
        assert by_key["validate_query"]["error"]["cause"] == "query_not_read_only"
        assert by_key["execute_graph_query"]["status"] == "queued"
