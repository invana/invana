"""MCP plugins: a server's tools frozen as task types, called, added and refreshed over the API
(docs/for-developers/modules/platform/features/mcp-plugins.md).

The MCP server is real — the SDK's FastMCP, served over Streamable HTTP by
uvicorn on localhost — and so is the Postgres the API test writes to.
"""

from __future__ import annotations

import socket
import threading
import time
import uuid
from collections.abc import Iterator

import pytest
import pytest_asyncio
import uvicorn
from httpx import ASGITransport, AsyncClient
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import invana.server.admin.views  # noqa: F401 — every model, so `create_all` resolves every foreign key
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.plugins import install_mcp, load_plugins
from invana.plugins.mcp import client
from invana.plugins.mcp.plugin import freeze, to_plugin
from invana.plugins.sdk.context import TaskContext
from invana.plugins.sdk.errors import TaskFailure
from invana.plugins.sdk.manifest import SideEffect, Type
from invana.runtime import catalogue
from invana.runtime.managers import McpManager
from invana.runtime.models import TaskRun
from invana.server.app import create_app
from tests.sessions.conftest import db_engine  # noqa: F401 — the isolated-schema Postgres fixture


class Airport(BaseModel):
    code: str
    city: str


def _server() -> FastMCP:
    mcp = FastMCP("airports", stateless_http=True, json_response=True)

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
    def lookup(code: str) -> Airport:
        """Find an airport by its IATA code."""
        return Airport(code=code, city={"KEF": "Reykjavik"}.get(code, "unknown"))

    @mcp.tool()
    def book(flight: str, seats: int = 1) -> str:
        """Book seats on a flight."""
        return f"booked {seats} on {flight}"

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
    def fail() -> str:
        """Always fails."""
        raise ValueError("the runway is closed")

    @mcp.tool(name="has space")
    def spaced() -> str:
        return "unkeyable"

    return mcp


@pytest.fixture(scope="module")
def mcp_url() -> Iterator[str]:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(_server().streamable_http_app(), port=port, log_level="error"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}/mcp"
    server.should_exit = True
    thread.join(timeout=5)


@pytest.fixture
def clean_registry() -> Iterator[None]:
    yield
    install_mcp(())
    catalogue.sync()


def _ctx(args: dict, server: str = "airports") -> TaskContext:
    """A context with only what an MCP task type touches: its step's args and its secret names."""
    step = TaskRun(args=args)
    return TaskContext(db=None, manager=None, emitter=None, step=step, secrets=(f"mcp_{server}",))  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_a_servers_tools_freeze_into_task_types_and_run(mcp_url: str) -> None:
    server, listed = await client.list_tools(mcp_url, None)
    assert server["name"] == "airports"

    tools, skipped = freeze(listed)
    assert skipped == ["has space"]
    plugin = to_plugin(name="airports", url=mcp_url, revision=1, tools=tools)
    by_key = {t.key: t for t in plugin.tasks}
    assert plugin.manifest.kind == "mcp" and plugin.manifest.version == "1.0.0"
    assert set(by_key) == {"mcp.airports.lookup", "mcp.airports.book", "mcp.airports.fail"}
    assert by_key["mcp.airports.lookup"].side_effect is SideEffect.read
    assert by_key["mcp.airports.book"].side_effect is SideEffect.send
    book = by_key["mcp.airports.book"].args
    assert book["flight"].type is Type.str_ and book["flight"].required
    assert book["seats"].type is Type.int_ and not book["seats"].required and book["seats"].default == 1

    out = await by_key["mcp.airports.lookup"].run(_ctx({"code": "KEF"}), None)
    assert out.output["structured"] == {"code": "KEF", "city": "Reykjavik"}
    assert "Reykjavik" in out.output["text"]

    with pytest.raises(TaskFailure) as failed:
        await by_key["mcp.airports.fail"].run(_ctx({}), None)
    assert (failed.value.cls, failed.value.cause) == ("blocked", "mcp_tool_error")
    assert "runway is closed" in failed.value.message

    # A refresh keeps an unchanged tool's version and bumps a changed one's major.
    changed = [{**t, "description": "Book seats, now with meals."} if t["name"] == "book" else t for t in listed]
    again, _ = freeze(changed, previous=tools)
    versions = {t["name"]: t["version"] for t in again}
    assert versions == {"lookup": "1.0.0", "book": "2.0.0", "fail": "1.0.0"}


@pytest.mark.asyncio
async def test_an_unreachable_server_is_a_transient_failure() -> None:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    plugin = to_plugin(
        name="gone", url=f"http://127.0.0.1:{port}/mcp", revision=1, tools=[{"name": "ping", "version": "1.0.0"}]
    )
    with pytest.raises(TaskFailure) as failed:
        await plugin.tasks[0].run(_ctx({}, server="gone"), None)
    assert (failed.value.cls, failed.value.cause) == ("transient", "mcp_unreachable")


def _user(*, admin: bool) -> User:
    tag = uuid.uuid4().hex[:8]
    return User(email=f"{tag}@example.com", username=f"u_{tag}", password_hash="x", first_name="U", is_superuser=admin)


@pytest_asyncio.fixture
async def api(db_engine):  # noqa: F811
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http, who, admin, factory


@pytest.mark.asyncio
async def test_an_admin_adds_a_server_that_loads_at_start_and_refreshes(api, mcp_url, clean_registry) -> None:
    http, who, admin, factory = api
    body = {"name": "airports", "url": mcp_url}

    assert (await http.post("/api/v1/plugins/mcp", json=body)).status_code == 403
    who["as"] = admin
    assert (await http.post("/api/v1/plugins/mcp", json={**body, "name": "Bad Name"})).status_code == 422
    gone = {"name": "gone", "url": "http://127.0.0.1:9/mcp"}
    assert (await http.post("/api/v1/plugins/mcp", json=gone)).status_code == 422

    added = await http.post("/api/v1/plugins/mcp", json=body)
    assert added.status_code == 201, added.text
    server = added.json()
    assert server["plugin"] == "invana.mcp.airports" and server["revision"] == 1
    assert server["restart_required"] is True and server["skipped"] == ["has space"]
    assert (await http.post("/api/v1/plugins/mcp", json=body)).status_code == 409

    # Stored, not loaded: listed as such, and still switchable.
    listed = {p["name"]: p for p in (await http.get("/api/v1/plugins")).json()["items"]}
    assert listed["invana.mcp.airports"]["installed"] is False
    assert listed["invana.mcp.airports"]["restart_required"] is True
    assert (await http.post("/api/v1/plugins/invana.mcp.airports/enable")).json()["enabled"] is True
    assert "mcp.airports.lookup" not in catalogue.CATALOGUE

    # What a process does at start-up.
    async with factory() as s:
        assert await McpManager().load(s) == 1
    assert load_plugins().task("mcp.airports.lookup@1.0.0") is not None
    assert "mcp.airports.book" in catalogue.CATALOGUE and "mcp.airports.book" in catalogue.TASKS
    detail = (await http.get("/api/v1/plugins/invana.mcp.airports")).json()
    assert detail["installed"] is True and detail["enabled"] is True and detail["restart_required"] is False
    assert detail["secrets"] == ["mcp_airports"]

    refreshed = (await http.post("/api/v1/plugins/mcp/airports/refresh")).json()
    assert refreshed["revision"] == 2 and refreshed["loaded_revision"] == 1 and refreshed["restart_required"] is True
    assert (await http.post("/api/v1/plugins/mcp/nope/refresh")).status_code == 404
