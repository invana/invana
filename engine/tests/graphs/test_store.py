"""Tests for GraphConnectionStore CRUD operations."""

from __future__ import annotations

import pytest

from invana.apps.graphs.schemas import GraphConnectionCreate, GraphConnectionUpdate
from invana.core.errors import NotFoundError
from tests.graphs.conftest import TEST_CONNECTOR_CLASS, TEST_ENCRYPTION_KEY


@pytest.mark.asyncio
class TestGraphConnectionStoreCRUD:
    async def test_create_connection(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        assert connection.id is not None
        assert connection.uri == "bolt://localhost:7687"
        assert connection.status == "CONNECTING"
        assert connection.auth_encrypted is not None  # credentials encrypted

    async def test_get_connection(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        fetched = await store.get(session, connection.id)
        assert fetched is not None
        assert fetched.id == connection.id

    async def test_get_nonexistent_returns_none(self, session, store):
        result = await store.get(session, "nonexistent-id")
        assert result is None

    async def test_get_or_404_raises_for_missing(self, session, store):
        # A queryset answers "there is no such row" with a domain error, never an
        # HTTP one — server/app.py maps NotFoundError to 404 (migration-plan §4.1).
        with pytest.raises(NotFoundError):
            await store.get_or_404(session, "missing-id")

    async def test_list_all(self, session, store, connection_create_data):
        await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        data2 = GraphConnectionCreate(uri="bolt://host2:7687", connector_class=TEST_CONNECTOR_CLASS)
        await store.create(session, data=data2, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        connections = await store.list_all(session)
        uris = [c.uri for c in connections]
        assert "bolt://localhost:7687" in uris
        assert "bolt://host2:7687" in uris

    async def test_update_read_only_keeps_status(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        updated = await store.update(
            session,
            connection.id,
            data=GraphConnectionUpdate(read_only=True),
            encryption_key=TEST_ENCRYPTION_KEY,
        )
        assert updated.read_only is True
        assert updated.status == "CONNECTING"  # status unchanged

    async def test_update_uri_triggers_reconnecting(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        updated = await store.update(
            session,
            connection.id,
            data=GraphConnectionUpdate(uri="bolt://newhost:7687"),
            encryption_key=TEST_ENCRYPTION_KEY,
        )
        assert updated.uri == "bolt://newhost:7687"
        assert updated.status == "CONNECTING"

    async def test_soft_delete_sets_inactive(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        await store.soft_delete(session, connection.id)
        await session.commit()

        fetched = await store.get(session, connection.id)
        assert fetched.status == "INACTIVE"

    async def test_list_active_excludes_inactive(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()
        await store.soft_delete(session, connection.id)
        await session.commit()

        active = await store.list_active(session)
        assert all(c.status != "INACTIVE" for c in active)

    async def test_set_status(self, session, store, connection_create_data):
        connection = await store.create(session, data=connection_create_data, encryption_key=TEST_ENCRYPTION_KEY)
        await session.commit()

        await store.set_status(session, connection.id, "ACTIVE", latency_ms=42)
        await session.commit()

        fetched = await store.get(session, connection.id)
        assert fetched.status == "ACTIVE"
        assert fetched.latency_ms == 42
