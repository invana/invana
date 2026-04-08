"""Tests for Neo4jConnector — connection lifecycle and health check."""

from invana.graph.connectors.base.constants import Capability

from invana_neo4j import Neo4jConnector

from .conftest import NEO4J_DATABASE, NEO4J_PASSWORD, NEO4J_URI, NEO4J_USERNAME


class TestConnectionLifecycle:
    async def test_connect_and_disconnect(self):
        conn = Neo4jConnector(
            NEO4J_URI,
            username=NEO4J_USERNAME,
            password=NEO4J_PASSWORD,
            database=NEO4J_DATABASE,
        )
        await conn.connect()
        assert conn._connected is True
        assert conn._driver is not None
        await conn.disconnect()
        assert conn._connected is False

    async def test_async_context_manager(self):
        async with Neo4jConnector(
            NEO4J_URI,
            username=NEO4J_USERNAME,
            password=NEO4J_PASSWORD,
            database=NEO4J_DATABASE,
        ) as conn:
            assert conn._connected is True
            result = await conn.health_check()
            assert result is True

    async def test_health_check(self, connector):
        result = await connector.health_check()
        assert result is True

    async def test_capabilities(self, connector):
        caps = connector.capabilities()
        assert Capability.CYPHER in caps
        assert Capability.TRANSACTIONS in caps
        assert Capability.SCHEMA_ENFORCEMENT in caps

    async def test_querysets_initialized(self, connector):
        assert connector.data_reader is not None
        assert connector.data_writer is not None
        assert connector.schema_reader is not None
        assert connector.schema_writer is not None
        assert connector.bulk is not None
        assert connector.algorithms is not None
        assert connector.vector is not None

    async def test_raw_execute(self, connector):
        records = await connector.execute("RETURN 1 AS n")
        assert len(records) == 1
        assert records[0]["n"] == 1
