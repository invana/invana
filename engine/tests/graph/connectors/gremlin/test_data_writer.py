"""Integration tests for Gremlin data writer queryset."""


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
        }
        vertex = await connector.data_writer.create_vertex("Person", props)
        assert vertex.properties["name"] == "Charlie"
        assert vertex.properties["age"] == 25
        assert vertex.properties["score"] == 3.14
        assert vertex.properties["active"] is True


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

        # drop() should remove the vertex and its edges
        await connector.data_writer.delete_vertex(alice.id)

        count = await connector.data_reader.count_vertices("Person")
        assert count == 1  # Only Bob remains


class TestDeleteEdge:
    async def test_delete_edge(self, connector):
        alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
        bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})
        edge = await connector.data_writer.create_edge("KNOWS", alice.id, bob.id)

        await connector.data_writer.delete_edge(edge.id)

        count = await connector.data_reader.count_edges("KNOWS")
        assert count == 0

        # Vertices should still exist
        v_count = await connector.data_reader.count_vertices("Person")
        assert v_count == 2
