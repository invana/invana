"""This Graph's MCP server, end to end over HTTP
(docs/for-developers/modules/platform/features/this-graphs-mcp-server.md).

The owner serves the two data functions and mints a token narrowed to them on
one dataset. With it an MCP client initializes, lists two tools, validates
records (one without a key is named), and pushes a draft that is not current;
Recent calls lists both runs with their result lines, and the owner publishes.
A session token is refused, an unserved tool is a JSON-RPC error, and the
narrowed token on another dataset is refused naming its policy, opening no run.

The app database only — no graph database is touched.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Every table the FKs touch, so `create_all` builds them.
from invana.apps.agents.models import Agent  # noqa: F401
from invana.apps.boards.models import Board  # noqa: F401
from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.datasets.schemas import AuthorStep, DatasetCreate, DatasetVersionCreate
from invana.apps.flows.models import Flow  # noqa: F401
from invana.apps.govern.models import Lens  # noqa: F401
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.iam.managed import MANAGED
from invana.apps.iam.models import Policy
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401
from invana.apps.mcp_server.models import McpServed  # noqa: F401
from invana.apps.modeller.models import GraphModel  # noqa: F401
from invana.apps.sessions.models import Session  # noqa: F401
from invana.apps.skills.models import Skill  # noqa: F401
from invana.apps.work.models import Project  # noqa: F401
from invana.core.auth.jwt import encode_access_token
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.ledger.models import LedgerRow  # noqa: F401
from invana.runtime.interpreter.loop import TaskRuntime
from invana.runtime.models import TaskRun  # noqa: F401
from invana.server.app import create_app

pytestmark = pytest.mark.asyncio

G = "/api/v1/u/ravi/atlas"
AUTHORS = [AuthorStep(role="original", kind="organisation", name="Airport authority")]
V1 = [{"id": "LHR", "name": "Heathrow"}, {"id": "JFK", "name": "Kennedy"}]
NARROW = [
    {"actions": ["data.version.check", "data.version.draft"], "resources": ["dataset/ravi/airports"]},
]


@pytest_asyncio.fixture
async def owner(session):
    """The owner of one Graph with its managed policies, and two datasets they made."""
    user = User(email="ravi@example.com", username="ravi", password_hash="x", first_name="Ravi")
    session.add(user)
    await session.flush()
    graph = Graph(slug="atlas", name="Atlas", created_by_id=user.id, setup_state={})
    session.add(graph)
    await session.flush()
    session.add_all(
        [
            GraphMember(graph_id=graph.id, user_id=user.id, roles=["owner"]),
            *(
                Policy(
                    graph_id=graph.id,
                    name=m.name,
                    kind="managed",
                    status="saved",
                    version=1,
                    statements=list(m.statements),
                )
                for m in MANAGED
            ),
        ]
    )
    datasets = DatasetManager()
    for name in ("airports", "airlines"):
        ds = await datasets.create(
            session, payload=DatasetCreate(publisher="ravi", name=name, origin="official"), actor=user
        )
        await datasets.publish_version(
            session,
            dataset=ds,
            payload=DatasetVersionCreate(licence="CC-BY-4.0", author_chain=AUTHORS, records=V1),
            actor=user,
        )
    await session.commit()
    return user


@pytest_asyncio.fixture
async def client(session_factory):
    app = create_app()
    # The test transport runs no lifespan, so the runtime the endpoint works calls on is set here.
    app.state.task_runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")

    async def _override_session():
        async with session_factory() as sess:
            try:
                yield sess
                await sess.commit()
            except Exception:
                await sess.rollback()
                raise

    app.dependency_overrides[get_session] = _override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _signed_in(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {encode_access_token(user_id=user.id, is_superuser=False)}"}


def _rpc(method: str, params: dict | None = None, msg_id: int = 1) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params or {}}


async def _served_token(client: AsyncClient, owner: User) -> dict[str, str]:
    for fn in ("data.version.check", "data.version.draft"):
        put = await client.put(
            f"{G}/connections/server/served/function/{fn}", json={"served": True}, headers=_signed_in(owner)
        )
        assert put.status_code == 200, put.text
        assert put.json()["served"] is True
    minted = await client.post(
        f"{G}/iam/tokens",
        json={"name": "cc laptop", "statements": NARROW, "expires_in_days": 30},
        headers=_signed_in(owner),
    )
    assert minted.status_code == 201, minted.text
    return {"Authorization": f"Bearer {minted.json()['secret']}"}


async def test_claude_code_validates_and_pushes_a_draft_a_person_publishes(client, owner) -> None:
    token = await _served_token(client, owner)

    init = await client.post(
        f"{G}/mcp", json=_rpc("initialize", {"clientInfo": {"name": "claude-code"}}), headers=token
    )
    assert init.status_code == 200, init.text
    session_id = init.headers["Mcp-Session-Id"]
    headers = {**token, "Mcp-Session-Id": session_id}

    listed = (await client.post(f"{G}/mcp", json=_rpc("tools/list"), headers=headers)).json()
    assert sorted(t["name"] for t in listed["result"]["tools"]) == ["push_draft_version", "validate_records"]

    records = [*V1, {"id": "SFO", "name": "San Francisco"}, {"name": "No key"}]
    checked = await client.post(
        f"{G}/mcp",
        json=_rpc(
            "tools/call", {"name": "validate_records", "arguments": {"dataset": "ravi/airports", "records": records}}
        ),
        headers=headers,
    )
    result = checked.json()["result"]
    assert result["isError"] is False, result
    assert result["structuredContent"]["valid"] == 3
    assert len(result["structuredContent"]["rejected"]) == 1

    pushed = await client.post(
        f"{G}/mcp",
        json=_rpc(
            "tools/call",
            {
                "name": "push_draft_version",
                "arguments": {
                    "dataset": "ravi/airports",
                    "records": records[:3],
                    "licence": "CC-BY-4.0",
                    "author_chain": [a.model_dump(mode="json") for a in AUTHORS],
                },
            },
        ),
        headers=headers,
    )
    result = pushed.json()["result"]
    assert result["isError"] is False, result
    assert result["structuredContent"]["version"] == 2 and result["structuredContent"]["state"] == "draft"
    detail = (await client.get("/api/v1/datasets/ravi/airports", headers=_signed_in(owner))).json()
    assert detail["current_version"] == 1

    calls = (await client.get(f"{G}/connections/server/calls", headers=_signed_in(owner))).json()
    assert calls["total"] == 2
    assert [c["tool"] for c in calls["items"]] == ["push_draft_version", "validate_records"]
    assert all(c["client"] == "claude-code" and c["token"] == "cc laptop" and c["result"] for c in calls["items"])
    info = (await client.get(f"{G}/connections/server", headers=_signed_in(owner))).json()
    assert info["functions_served"] == 2 and info["calls_today"] == 2

    published = await client.post("/api/v1/datasets/ravi/airports/versions/2/publish", headers=_signed_in(owner))
    assert published.status_code == 200, published.text


async def test_a_session_an_unserved_tool_and_another_dataset_are_refused(client, owner) -> None:
    session_jwt = await client.post(f"{G}/mcp", json=_rpc("tools/list"), headers=_signed_in(owner))
    assert session_jwt.status_code == 401

    token = await _served_token(client, owner)
    await client.put(
        f"{G}/connections/server/served/function/data.version.check", json={"served": False}, headers=_signed_in(owner)
    )
    unserved = await client.post(
        f"{G}/mcp",
        json=_rpc("tools/call", {"name": "validate_records", "arguments": {"dataset": "ravi/airports", "records": V1}}),
        headers=token,
    )
    assert unserved.json()["error"]["code"] == -32602

    other = await client.post(
        f"{G}/mcp",
        json=_rpc(
            "tools/call",
            {
                "name": "push_draft_version",
                "arguments": {"dataset": "ravi/airlines", "records": V1, "licence": "CC-BY-4.0"},
            },
        ),
        headers=token,
    )
    result = other.json()["result"]
    assert result["isError"] is True
    assert "token-cc-laptop" in result["content"][0]["text"]
    runs = (await client.get(f"{G}/connections/server/calls", headers=_signed_in(owner))).json()
    assert runs["total"] == 0
