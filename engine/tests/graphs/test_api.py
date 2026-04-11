"""Integration tests for the Graphs and Query REST API endpoints.

These tests use FastAPI's async test client with an in-memory SQLite engine
so they don't require a running graph database.  Graph connection is mocked
at the GraphConnectionManager level because connecting to a real DB is tested
separately in the integration test suite.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from invana.graphs.schemas import GraphCreate
from invana.graphs.store import GraphModelStore
from invana.modeller.models import Base
from invana.server.app import create_app
from tests.graphs.conftest import TEST_CONNECTOR_CLASS, TEST_ENCRYPTION_KEY

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.fixture
def mock_manager():
    """Return a mock GraphConnectionManager that does nothing."""
    manager = MagicMock()
    manager.startup = AsyncMock()
    manager.shutdown = AsyncMock()
    manager.register = AsyncMock()
    manager.deregister = AsyncMock()
    manager.reconnect = AsyncMock()
    return manager


@pytest.fixture
async def app_with_db(tmp_path, mock_manager):
    """Build app against an in-memory SQLite DB with patched connection manager."""
    db_url = f"sqlite+aiosqlite:///{tmp_path}/test.db"
    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    app = create_app()

    # Override lifespan state directly
    app.state.db_engine = engine
    app.state.db_session_factory = session_factory
    app.state.graph_connection_manager = mock_manager

    from invana.db import get_session

    async def _override_session():
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_session] = _override_session

    yield app, session_factory, mock_manager

    await engine.dispose()


# ---------------------------------------------------------------------------
# CRUD tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGraphsAPI:
    async def test_create_graph(self, app_with_db):
        app, _, mock_manager = app_with_db
        payload = {
            "name": "My Neo4j",
            "uri": "bolt://localhost:7687",
            "connector_class": TEST_CONNECTOR_CLASS,
            "auth": {"username": "neo4j", "password": "secret"},
        }
        with patch("invana.server.routes.graphs.settings") as mock_settings:
            mock_settings.encryption_key = TEST_ENCRYPTION_KEY
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post("/api/v1/graphs", json=payload)

        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Neo4j"
        assert data["status"] == "CONNECTING"
        assert "auth_encrypted" not in data
        mock_manager.register.assert_awaited_once()

    async def test_list_graphs(self, app_with_db):
        app, session_factory, _ = app_with_db
        async with session_factory() as session:
            store = GraphModelStore()
            await store.create(
                session,
                data=GraphCreate(name="G1", uri="bolt://h:7687", connector_class=TEST_CONNECTOR_CLASS),
                encryption_key=TEST_ENCRYPTION_KEY,
            )
            await session.commit()

        with patch("invana.server.routes.graphs.settings") as mock_settings:
            mock_settings.encryption_key = TEST_ENCRYPTION_KEY
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/api/v1/graphs")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1

    async def test_get_graph_not_found(self, app_with_db):
        app, _, _ = app_with_db
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/graphs/nonexistent-id")
        assert resp.status_code == 404

    async def test_delete_graph(self, app_with_db):
        app, session_factory, mock_manager = app_with_db
        async with session_factory() as session:
            store = GraphModelStore()
            graph = await store.create(
                session,
                data=GraphCreate(name="Del Me", uri="bolt://h:7687", connector_class=TEST_CONNECTOR_CLASS),
                encryption_key=TEST_ENCRYPTION_KEY,
            )
            await session.commit()
            graph_id = graph.id

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(f"/api/v1/graphs/{graph_id}")

        assert resp.status_code == 204
        mock_manager.deregister.assert_awaited()

    async def test_query_graph_not_active(self, app_with_db):
        """Query against a graph not in the manager registry should return 503."""
        from invana.graphs.manager import GraphUnavailableError

        app, session_factory, mock_manager = app_with_db
        mock_manager.get_connector.side_effect = GraphUnavailableError("some-id")

        async with session_factory() as session:
            store = GraphModelStore()
            graph = await store.create(
                session,
                data=GraphCreate(name="Q Test", uri="bolt://h:7687", connector_class=TEST_CONNECTOR_CLASS),
                encryption_key=TEST_ENCRYPTION_KEY,
            )
            await session.commit()
            graph_id = graph.id

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/graphs/{graph_id}/query",
                json={"query": "MATCH (n) RETURN n LIMIT 1"},
            )
        assert resp.status_code == 503
