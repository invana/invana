"""The request span says who called, from where, and in which Graph.

A small app wrapped in the real TelemetryMiddleware, with routes behind the real
``get_current_user`` and ``resolve_graph_by_username_slug`` dependencies, against
a real Postgres schema. Spans go to an in-memory exporter.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from invana.apps.graphs.models import Graph
from invana.core.auth.deps import get_current_user
from invana.core.auth.jwt import encode_access_token
from invana.core.auth.managers import AuthManager
from invana.core.db import get_session
from invana.core.telemetry import middleware
from invana.core.telemetry.middleware import TelemetryMiddleware
from invana.server.app import create_app
from invana.server.graphs.deps import resolve_graph_by_username_slug

pytestmark = pytest.mark.asyncio

# Building the real app imports every module, registering every model on the
# shared metadata so the schema fixture can create the tables a Graph reaches.
create_app()


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(middleware, "tracer", provider.get_tracer("test"))
    return exp


@pytest_asyncio.fixture
async def client(session_factory):
    app = FastAPI()

    @app.get("/open")
    async def open_route():
        return {}

    @app.get("/u/{username}/{graphSlug}/probe")
    async def probe(user=Depends(get_current_user), graph=Depends(resolve_graph_by_username_slug)):
        return {}

    async def _override_session():
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_session] = _override_session
    app.add_middleware(TelemetryMiddleware)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _user_and_graph(session):
    user = await AuthManager().provision_user(
        session,
        email="ada@example.com",
        password="Sup3rSecret!pw",
        username="ada",
        first_name="Ada",
        last_name=None,
    )
    graph = Graph(slug="airways", name="Airways", created_by_id=user.id)
    session.add(graph)
    await session.commit()
    return user, graph


async def test_a_signed_in_graph_request_names_the_caller_and_the_graph(session, client, exporter):
    user, graph = await _user_and_graph(session)
    token = encode_access_token(user_id=user.id, is_superuser=False)

    res = await client.get("/u/ada/airways/probe", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    (span,) = exporter.get_finished_spans()
    assert span.attributes["enduser.id"] == user.id
    assert span.attributes["invana.principal"] == "user"
    assert span.attributes["invana.origin"] == "studio"
    assert span.attributes["invana.graph"] == "ada/airways"
    assert span.attributes["invana.graph_id"] == graph.id


async def test_an_unauthenticated_request_is_anonymous(client, exporter):
    res = await client.get("/open")

    assert res.status_code == 200
    (span,) = exporter.get_finished_spans()
    assert span.attributes["invana.principal"] == "anonymous"
    assert "enduser.id" not in span.attributes
