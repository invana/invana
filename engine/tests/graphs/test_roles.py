"""Graph roles, the policy that enforces them, and access-filtered search
(docs/for-developers/modules/identity-and-access/features/roles.md ·
docs/for-developers/modules/platform/features/search.md), against a real Postgres.

Auth is the one override — a real ``User`` row picked per request — so the slug
resolver, the membership gate and the role check all run as they do in production.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient

from invana.apps.graphs.roles import GRAPH_PREFIX, READ_METHODS, area_for, holds, normalise
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.server.app import create_app
from invana.server.graphs.deps import require_graph_member


def _dependencies(dependant) -> set:
    found = {dependant.call}
    for sub in dependant.dependencies:
        found |= _dependencies(sub)
    return found


def test_every_graph_write_route_is_named_by_the_policy() -> None:
    """A write route the table does not name would silently need `owner`; a route
    without the gate would need nothing at all."""
    unnamed, ungated = [], []
    for route in create_app().routes:
        if not isinstance(route, APIRoute) or not route.path.startswith(GRAPH_PREFIX):
            continue
        if require_graph_member not in _dependencies(route.dependant):
            ungated.append(route.path)
        for method in route.methods - READ_METHODS:
            if area_for(method, route.path) is None:
                unnamed.append(f"{method} {route.path}")
    assert not ungated, f"Graph routes without require_graph_member: {ungated}"
    assert not unnamed, f"Write routes the role policy does not name: {unnamed}"


def test_the_policy_reads_the_narrowest_prefix() -> None:
    assert area_for("POST", f"{GRAPH_PREFIX}/models/{{model_id}}/commit").role == "modeller"
    assert area_for("POST", f"{GRAPH_PREFIX}/projects/{{key}}/rules").role == "modeller"
    assert area_for("PATCH", f"{GRAPH_PREFIX}/projects/{{key}}").role == "contributor"
    assert area_for("POST", f"{GRAPH_PREFIX}/runs/{{run_id}}/emissions/{{emission_id}}/template").role == "builder"
    assert area_for("POST", f"{GRAPH_PREFIX}/runs/{{run_id}}/answer").role == "viewer"
    assert area_for("DELETE", GRAPH_PREFIX).role == "owner"
    assert area_for("GET", f"{GRAPH_PREFIX}/members") is None
    assert holds(["owner"], "modeller") and holds(["builder"], "viewer") and not holds(["builder"], "modeller")
    assert normalise([]) == ["viewer"] and normalise(["Owner", "viewer", "builder"]) == ["builder", "owner"]
    with pytest.raises(ValueError, match="not a Graph role"):
        normalise(["admin"])


# ── over HTTP ────────────────────────────────────────────────────────────────


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
    app.state.db_session_factory = session_factory
    who = {"user": people["ada"]}
    app.dependency_overrides[get_current_user] = lambda: who["user"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        c.as_ = lambda user: who.__setitem__("user", user)
        yield c


@pytest_asyncio.fixture
async def graph_url(client, people) -> str:
    slug = f"atlas-{uuid.uuid4().hex[:6]}"
    resp = await client.post("/api/v1/graphs", json={"name": "Atlas Routes", "slug": slug})
    assert resp.status_code == 201, resp.text
    return f"/api/v1/u/{people['ada'].username}/{slug}"


@pytest.mark.asyncio
async def test_a_viewer_reads_but_a_write_names_the_role_and_who_holds_it(client, people, graph_url) -> None:
    ada, bo = people["ada"], people["bo"]
    added = await client.post(f"{graph_url}/members", json={"user": bo.email})
    assert added.status_code == 201, added.text
    assert added.json()["roles"] == ["viewer"]

    client.as_(bo)
    assert (await client.get(graph_url)).status_code == 200
    refused = await client.patch(graph_url, json={"name": "Renamed"})
    assert refused.status_code == 403
    detail = refused.json()["detail"]
    assert detail["error"] == "role_required" and detail["role"] == "owner"
    assert detail["holders"] == [ada.username]

    access = (await client.get(f"{graph_url}/access")).json()
    assert access["roles"] == ["viewer"]
    assert {a["area"]: a["allowed"] for a in access["areas"]} == {
        "ask": True,
        "work": False,
        "build": False,
        "model": False,
        "settings": False,
        "iam": False,
    }

    client.as_(ada)
    changed = await client.patch(f"{graph_url}/members/{bo.username}", json={"roles": ["modeller"]})
    assert changed.json()["roles"] == ["modeller"]
    client.as_(bo)
    access = (await client.get(f"{graph_url}/access")).json()
    assert {a["area"]: a["allowed"] for a in access["areas"]}["model"] is True

    me = (await client.get("/api/v1/auth/me")).json()
    assert [g["roles"] for g in me["graphs"]] == [["modeller"]]


@pytest.mark.asyncio
async def test_a_graph_always_has_an_owner(client, people, graph_url) -> None:
    ada = people["ada"]
    demoted = await client.patch(f"{graph_url}/members/{ada.username}", json={"roles": ["builder"]})
    assert demoted.status_code == 409
    assert "always has an owner" in demoted.text
    assert (await client.delete(f"{graph_url}/members/{ada.username}")).status_code == 409
    unknown = await client.post(f"{graph_url}/members", json={"user": people["bo"].email, "roles": ["admin"]})
    assert unknown.status_code == 422


@pytest.mark.asyncio
async def test_search_finds_only_what_the_reader_may_open(client, people, graph_url) -> None:
    hits = (await client.get("/api/v1/search", params={"q": "atlas"})).json()["hits"]
    assert [(h["kind"], h["name"], h["match"]) for h in hits if h["kind"] == "graph"] == [
        ("graph", "Atlas Routes", "prefix")
    ]
    ref = graph_url.removeprefix("/api/v1/u/")
    agents = (await client.get("/api/v1/search", params={"q": "explorer", "graph": ref})).json()["hits"]
    assert any(h["kind"] == "agent" and h["graph"] == ref and h["product"] == "agents" for h in agents)

    client.as_(people["bo"])
    assert (await client.get("/api/v1/search", params={"q": "atlas"})).json()["hits"] == []
    assert (await client.get("/api/v1/search", params={"q": "atlas", "graph": ref})).status_code == 404
