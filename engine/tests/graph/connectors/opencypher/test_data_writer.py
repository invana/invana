"""Integration tests for OpenCypher data writer queryset against a real Neo4j instance."""

import pytest


class TestCreateVertex:
    async def test_create_vertex_with_properties(self, connector):
        vertex = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30})
        assert vertex.id is not None
        assert vertex.label == "Person"
        assert vertex.properties["name"] == "Alice"
        assert vertex.properties["age"] == 30

    async def test_create_vertex_empty_properties(self, connector):
        vertex = await connector.data_writer.create_vertex("EmptyNode", {})
        assert vertex.id is not None
        assert vertex.label == "EmptyNode"
        assert vertex.properties == {}

    async def test_create_multiple_vertices(self, connector):
        v1 = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        v2 = await connector.data_writer.create_vertex("Person", {"name": "Bob"})
        assert v1.id != v2.id
        assert v1.properties["name"] == "Alice"
        assert v2.properties["name"] == "Bob"

    async def test_create_vertex_with_various_types(self, connector):
        props = {
            "name": "Charlie",
            "age": 25,
            "score": 3.14,
            "active": True,
            "tags": ["dev", "python"],
        }
        vertex = await connector.data_writer.create_vertex("Person", props)
        assert vertex.properties["name"] == "Charlie"
        assert vertex.properties["age"] == 25
        assert vertex.properties["score"] == 3.14
        assert vertex.properties["active"] is True
        assert vertex.properties["tags"] == ["dev", "python"]


class TestCreateEdge:
    async def test_create_edge_with_properties(self, connector):
        alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})

        edge = await connector.data_writer.create_edge("KNOWS", alice.id, bob.id, {"since": 2020})
        assert edge.id is not None
        assert edge.label == "KNOWS"
        assert edge.source == alice.id
        assert edge.target == bob.id
        assert edge.properties["since"] == 2020

    async def test_create_edge_without_properties(self, connector):
        alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})

        edge = await connector.data_writer.create_edge("KNOWS", alice.id, bob.id)
        assert edge.id is not None
        assert edge.label == "KNOWS"
        assert edge.properties == {}

    async def test_create_edge_between_different_labels(self, connector):
        person = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        company = await connector.data_writer.create_vertex("Company", {"name": "Acme"})

        edge = await connector.data_writer.create_edge("WORKS_AT", person.id, company.id, {"role": "Engineer"})
        assert edge.label == "WORKS_AT"
        assert edge.source == person.id
        assert edge.target == company.id


class TestUpdateVertex:
    async def test_update_vertex_properties(self, connector):
        vertex = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30})

        updated = await connector.data_writer.update_vertex(vertex.id, {"age": 31, "city": "NYC"})
        assert updated.id == vertex.id
        assert updated.properties["name"] == "Alice"  # original preserved
        assert updated.properties["age"] == 31  # updated
        assert updated.properties["city"] == "NYC"  # added

    async def test_update_vertex_add_new_property(self, connector):
        vertex = await connector.data_writer.create_vertex("Person", {"name": "Bob"})

        updated = await connector.data_writer.update_vertex(vertex.id, {"email": "bob@example.com"})
        assert updated.properties["name"] == "Bob"
        assert updated.properties["email"] == "bob@example.com"


class TestUpdateEdge:
    async def test_update_edge_properties(self, connector):
        alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})
        edge = await connector.data_writer.create_edge("KNOWS", alice.id, bob.id, {"since": 2020})

        updated = await connector.data_writer.update_edge(edge.id, {"since": 2021, "strength": 0.9})
        assert updated.id == edge.id
        assert updated.properties["since"] == 2021
        assert updated.properties["strength"] == 0.9


class TestDeleteVertex:
    async def test_delete_vertex(self, connector):
        vertex = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        assert vertex.id is not None

        await connector.data_writer.delete_vertex(vertex.id)

        count = await connector.data_reader.count_vertices("Person")
        assert count == 0

    async def test_delete_vertex_with_edges(self, connector):
        alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})
        await connector.data_writer.create_edge("KNOWS", alice.id, bob.id)

        # DETACH DELETE should remove the vertex and its edges
        await connector.data_writer.delete_vertex(alice.id)

        count = await connector.data_reader.count_vertices("Person")
        assert count == 1  # only Bob remains
        edge_count = await connector.data_reader.count_edges("KNOWS")
        assert edge_count == 0


class TestDeleteEdge:
    async def test_delete_edge(self, connector):
        alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})
        edge = await connector.data_writer.create_edge("KNOWS", alice.id, bob.id)

        await connector.data_writer.delete_edge(edge.id)

        edge_count = await connector.data_reader.count_edges("KNOWS")
        assert edge_count == 0
        # Vertices should still exist
        node_count = await connector.data_reader.count_vertices("Person")
        assert node_count == 2


class TestRelabelAndUnset:
    async def test_relabel_vertex_keeps_its_properties(self, connector):
        v = await connector.data_writer.create_vertex("Draft", {"name": "Alice"})
        await connector.data_writer.relabel_vertex(v.id, "Draft", "Person")
        read = await connector.data_reader.read_vertex_by_id(v.id)
        assert read.label == "Person"
        assert read.properties["name"] == "Alice"

    async def test_unset_removes_only_the_named_keys(self, connector):
        v = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30})
        await connector.data_writer.unset_vertex_properties(v.id, ["age", "missing"])
        read = await connector.data_reader.read_vertex_by_id(v.id)
        assert read.properties == {"name": "Alice"}


class TestApplyEdits:
    """A board's batch, written through the data writer — refs resolve, a stale type stops it."""

    async def test_a_batch_writes_in_order_and_maps_refs(self, connector):
        from invana.apps.modeller.managers.data_edit import DataEditManager
        from invana.apps.modeller.schemas import DataEditBatch, ModelIndex

        index = ModelIndex(version_id="v", nodes={"airport": {"code": "string"}}, edges={"route": {"weekly": "int"}})
        manager = DataEditManager()
        batch = DataEditBatch.model_validate(
            {
                "edits": [
                    {"op": "add_node", "ref": "a", "type": "airport", "properties": {"code": "DOH"}},
                    {"op": "add_node", "ref": "b", "type": "airport", "properties": {"code": "DXB"}},
                    {
                        "op": "add_edge",
                        "ref": "r",
                        "type": "route",
                        "source": "a",
                        "target": "b",
                        "properties": {"weekly": "7"},
                    },
                ]
            }
        )
        ids, applied = await manager.apply_edits(connector, manager.check_batch(batch, index))
        assert applied == 3
        edge = await connector.data_reader.read_edge_by_id(ids["r"])
        assert edge.properties["weekly"] == 7

    async def test_an_element_of_another_type_is_refused(self, connector):
        from invana.apps.modeller.managers.data_edit import DataEditManager, EditFailed
        from invana.apps.modeller.schemas import DataEditBatch, ModelIndex

        v = await connector.data_writer.create_vertex("country", {"name": "Qatar"})
        index = ModelIndex(version_id="v", nodes={"airport": {"code": "string"}}, edges={})
        manager = DataEditManager()
        batch = DataEditBatch.model_validate({"edits": [{"op": "delete_node", "id": v.id, "type": "airport"}]})
        with pytest.raises(EditFailed) as caught:
            await manager.apply_edits(connector, manager.check_batch(batch, index))
        assert caught.value.code == "stale_type"
        assert caught.value.applied == 0
