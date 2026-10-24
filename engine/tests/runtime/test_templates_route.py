"""`GET …/projection-templates` — this Graph's templates and the shipped ones, on
the list contract (docs/for-developers/modules/platform/features/list-contract.md).

Real Postgres, no mocks. Auth and membership are overridden — they have their
own tests — so what is under test is the search, the filters and the counts.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime.models import ProjectionTemplate
from invana.server.app import create_app
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

pytestmark = pytest.mark.asyncio

URL = "/api/v1/u/owner/atlas/projection-templates"


@pytest_asyncio.fixture
async def client(db_engine):
    """A Graph with two templates of its own, one shipped, and one of another Graph's."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as s:
        user = User(
            email=f"{uuid.uuid4().hex[:8]}@example.com",
            username=f"u_{uuid.uuid4().hex[:8]}",
            password_hash="x",
            first_name="Owner",
        )
        s.add(user)
        await s.flush()
        graph = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="Atlas", created_by_id=user.id, setup_state={})
        other = Graph(slug=f"g-{uuid.uuid4().hex[:6]}", name="Other", created_by_id=user.id, setup_state={})
        s.add_all([graph, other])
        await s.flush()
        s.add(GraphMember(graph_id=graph.id, user_id=user.id, roles=["owner"]))
        s.add_all(
            [
                ProjectionTemplate(graph_id=graph.id, name="top-movers", kind="result", surface="chart"),
                ProjectionTemplate(graph_id=graph.id, name="pick-one", kind="prompt", surface="choice"),
                ProjectionTemplate(graph_id=None, name="rows", kind="result", surface="table", intent="movers"),
                ProjectionTemplate(graph_id=other.id, name="elsewhere", kind="result", surface="table"),
            ]
        )
        await s.commit()
        user_id, graph_id = user.id, graph.id

    async with factory() as s:
        user = await s.get(User, user_id)
        graph = await s.get(Graph, graph_id)
        member = await s.get(GraphMember, (graph_id, user_id))

    app = create_app()
    app.state.db_session_factory = factory

    async def _override_session():
        async with factory() as sess:
            yield sess

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_graph_member] = lambda: member
    app.dependency_overrides[resolve_graph_by_username_slug] = lambda: graph

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


class TestTemplatesRoute:
    async def test_search_and_presets_are_counted_by_the_engine(self, client):
        """`q` matches the intent too; `kind` narrows; another Graph's template is never counted."""
        body = (await client.get(URL, params={"q": "movers", "kind": "result"})).json()

        assert sorted(i["name"] for i in body["items"]) == ["rows", "top-movers"]
        assert (body["total"], body["unfiltered_total"]) == (2, 3)
        assert [(a["field"], a["label"]) for a in body["applied"]] == [("q", "movers"), ("kind", "Result")]

        shipped = (await client.get(URL, params={"surface": "table"})).json()["items"]
        assert [(i["name"], i["shipped"]) for i in shipped] == [("rows", True)]

    async def test_a_filter_the_list_does_not_take_is_refused(self, client):
        assert (await client.get(URL, params={"surface": "carousel"})).status_code == 422
        assert (await client.get(URL, params={"status": "draft"})).status_code == 422
