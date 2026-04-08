"""Integration tests for Gremlin bulk queryset."""


class TestBulkCreateVertices:
    async def test_bulk_create_multiple(self, connector):
        records = [
            {"name": "V1", "type": "test"},
            {"name": "V2", "type": "test"},
            {"name": "V3", "type": "test"},
        ]
        vertices = await connector.bulk.bulk_create_vertices("BulkNode", records)
        assert len(vertices) == 3
        names = {v.properties["name"] for v in vertices}
        assert names == {"V1", "V2", "V3"}

    async def test_bulk_create_empty_list(self, connector):
        vertices = await connector.bulk.bulk_create_vertices("BulkNode", [])
        assert vertices == []

    async def test_bulk_create_with_various_properties(self, connector):
        records = [
            {"name": "A", "count": 1, "active": True},
            {"name": "B", "count": 2, "active": False},
        ]
        vertices = await connector.bulk.bulk_create_vertices("BulkNode", records)
        assert len(vertices) == 2
        for v in vertices:
            assert "name" in v.properties
            assert "count" in v.properties
            assert "active" in v.properties

    async def test_bulk_created_vertices_are_readable(self, connector):
        records = [{"name": f"Readable{i}"} for i in range(5)]
        await connector.bulk.bulk_create_vertices("Readable", records)
        count = await connector.data_reader.count_vertices("Readable")
        assert count == 5


class TestBulkCreateEdges:
    async def test_bulk_create_multiple(self, connector):
        v1 = await connector.data_writer.create_vertex("Source", {"name": "S1"})
        v2 = await connector.data_writer.create_vertex("Source", {"name": "S2"})
        v3 = await connector.data_writer.create_vertex("Target", {"name": "T1"})

        records = [
            {"source_id": v1.id, "target_id": v3.id, "properties": {"weight": 1}},
            {"source_id": v2.id, "target_id": v3.id, "properties": {"weight": 2}},
        ]
        edges = await connector.bulk.bulk_create_edges("LINKS_TO", records)
        assert len(edges) == 2
        weights = {e.properties.get("weight") for e in edges}
        assert weights == {1, 2}

    async def test_bulk_create_edges_empty(self, connector):
        edges = await connector.bulk.bulk_create_edges("LINKS_TO", [])
        assert edges == []

    async def test_bulk_created_edges_are_readable(self, connector):
        v1 = await connector.data_writer.create_vertex("Node", {"name": "A"})
        v2 = await connector.data_writer.create_vertex("Node", {"name": "B"})
        v3 = await connector.data_writer.create_vertex("Node", {"name": "C"})

        records = [
            {"source_id": v1.id, "target_id": v2.id, "properties": {}},
            {"source_id": v1.id, "target_id": v3.id, "properties": {}},
            {"source_id": v2.id, "target_id": v3.id, "properties": {}},
        ]
        await connector.bulk.bulk_create_edges("BULK_EDGE", records)
        count = await connector.data_reader.count_edges("BULK_EDGE")
        assert count == 3


class TestBulkDeleteVertices:
    async def test_bulk_delete(self, connector):
        v1 = await connector.data_writer.create_vertex("Temp", {"name": "D1"})
        v2 = await connector.data_writer.create_vertex("Temp", {"name": "D2"})
        await connector.data_writer.create_vertex("Temp", {"name": "D3"})

        count_before = await connector.data_reader.count_vertices("Temp")
        assert count_before == 3

        deleted = await connector.bulk.bulk_delete_vertices([v1.id, v2.id])
        assert deleted == 2

        count_after = await connector.data_reader.count_vertices("Temp")
        assert count_after == 1

    async def test_bulk_delete_empty_list(self, connector):
        deleted = await connector.bulk.bulk_delete_vertices([])
        assert deleted == 0


class TestBulkDeleteEdges:
    async def test_bulk_delete(self, connector):
        v1 = await connector.data_writer.create_vertex("Node", {"name": "X"})
        v2 = await connector.data_writer.create_vertex("Node", {"name": "Y"})
        v3 = await connector.data_writer.create_vertex("Node", {"name": "Z"})

        e1 = await connector.data_writer.create_edge("TEST_EDGE", v1.id, v2.id)
        e2 = await connector.data_writer.create_edge("TEST_EDGE", v1.id, v3.id)
        await connector.data_writer.create_edge("TEST_EDGE", v2.id, v3.id)

        deleted = await connector.bulk.bulk_delete_edges([e1.id, e2.id])
        assert deleted == 2

        count_after = await connector.data_reader.count_edges("TEST_EDGE")
        assert count_after == 1

    async def test_bulk_delete_empty_list(self, connector):
        deleted = await connector.bulk.bulk_delete_edges([])
        assert deleted == 0
