"""Tests for GraphModelStore CRUD operations."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from invana.graphs.schemas import GraphCreate, GraphUpdate
from tests.graphs.conftest import TEST_CONNECTOR_CLASS, TEST_ENCRYPTION_KEY


@pytest.mark.asyncio
class TestGraphModelStoreCRUD:
    async def test_create_graph(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        assert graph.id is not None
        assert graph.name == "Test Graph"
        assert graph.status == "CONNECTING"
        assert graph.auth_encrypted is not None  # credentials encrypted

    async def test_get_graph(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        fetched = await store.get(session, graph.id)
        assert fetched is not None
        assert fetched.id == graph.id

    async def test_get_nonexistent_returns_none(self, session, store):
        result = await store.get(session, "nonexistent-id")
        assert result is None

    async def test_get_or_404_raises_for_missing(self, session, store):
        with pytest.raises(HTTPException) as exc_info:
            await store.get_or_404(session, "missing-id")
        assert exc_info.value.status_code == 404

    async def test_list_all(self, session, store, graph_create_data):
        await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        data2 = GraphCreate(
            name="Graph B",
            uri="bolt://host2:7687",
            connector_class=TEST_CONNECTOR_CLASS,
        )
        await store.create(session, data=data2, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        graphs = await store.list_all(session)
        names = [g.name for g in graphs]
        assert "Test Graph" in names
        assert "Graph B" in names

    async def test_update_name(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        updated = await store.update(
            session,
            graph.id,
            data=GraphUpdate(name="Renamed"),
            encryption_key=TEST_ENCRYPTION_KEY,
        )
        assert updated.name == "Renamed"
        assert updated.status == "CONNECTING"  # status unchanged

    async def test_update_uri_triggers_reconnecting(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        updated = await store.update(
            session,
            graph.id,
            data=GraphUpdate(uri="bolt://newhost:7687"),
            encryption_key=TEST_ENCRYPTION_KEY,
        )
        assert updated.uri == "bolt://newhost:7687"
        assert updated.status == "CONNECTING"

    async def test_soft_delete_sets_inactive(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        await store.soft_delete(session, graph.id)
        await session.commit()

        fetched = await store.get(session, graph.id)
        assert fetched.status == "INACTIVE"

    async def test_list_active_excludes_inactive(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()
        await store.soft_delete(session, graph.id)
        await session.commit()

        active = await store.list_active(session)
        assert all(g.status != "INACTIVE" for g in active)

    async def test_set_status(self, session, store, graph_create_data):
        graph = await store.create(session, data=graph_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        await store.set_status(session, graph.id, "ACTIVE", latency_ms=42)
        await session.commit()

        fetched = await store.get(session, graph.id)
        assert fetched.status == "ACTIVE"
        assert fetched.latency_ms == 42
