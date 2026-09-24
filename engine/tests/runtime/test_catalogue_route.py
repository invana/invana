"""`GET …/catalogue` — the closed set, rendered, with how many plans name each entry
(docs/for-developers/modules/workflows/features/the-catalogue.md).

Real Postgres, no mocks. Auth and membership are overridden — they have their
own tests — so what is under test is the wiring and the shape on the wire.
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.task_plans.models import Task, TaskPlan
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.catalogue.registry import Bound
from invana.server.app import create_app
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

pytestmark = pytest.mark.asyncio

URL = "/api/v1/u/owner/atlas/catalogue"


def _plan(graph_id: str, *, key: str | None, version: int = 1, reusable: bool = True) -> TaskPlan:
    return TaskPlan(graph_id=graph_id, key=key, version=version, reusable=reusable, origin="authored")


@pytest_asyncio.fixture
async def client(db_engine):
    """A Graph whose library names `execute_graph_query` from one plan key in two
    versions, from a one-off plan, and from another Graph's plan."""
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
        member = GraphMember(graph_id=graph.id, user_id=user.id)
        plans = [
            _plan(graph.id, key="ask-once", version=1),
            _plan(graph.id, key="ask-once", version=2),
            _plan(graph.id, key=None, reusable=False),
            _plan(other.id, key="elsewhere"),
        ]
        s.add(member)
        s.add_all(plans)
        await s.flush()
        s.add_all(
            Task(task_plan_id=p.id, key="execute", form="callable", step_key="execute_graph_query") for p in plans
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


class TestCatalogueRoute:
    async def test_every_entry_arrives_grouped_by_bound_with_its_contract(self, client):
        resp = await client.get(URL)

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == len(CATALOGUE)
        order = [b.value for b in Bound]
        bounds = [item["bound"] for item in body["items"]]
        assert bounds == sorted(bounds, key=order.index)

        query = next(i for i in body["items"] if i["step_key"] == "execute_graph_query")
        assert query["summary"]
        assert query["requires"] == ["validate_query"]
        assert {"name": "rows", "type": "int", "rollup": "sum"} in query["outputs"]

    async def test_used_by_counts_this_graphs_reusable_plan_keys_only(self, client):
        """Two versions of one key count once; a one-off and another Graph's plan not at all."""
        items = {i["step_key"]: i for i in (await client.get(URL)).json()["items"]}

        assert items["execute_graph_query"]["used_by"] == 1
        assert items["bulk_write"]["used_by"] == 0
