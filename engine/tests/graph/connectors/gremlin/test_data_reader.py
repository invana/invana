"""Integration tests for Gremlin data reader queryset."""

import pytest

from invana.graph.connectors.base.data_types.filter_types import FilterOp
from invana.graph.connectors.base.data_types.filters import FilterExpression, FilterGroup, LogicalOp
from invana.graph.types.sort import SortDirection, SortSpec


@pytest.fixture
async def seeded_graph(connector):
    """Seed the graph with a small test dataset and return vertex/edge IDs."""
    alice = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30, "city": "NYC"})
    bob = await connector.data_writer.create_vertex("Person", {"name": "Bob", "age": 25, "city": "LA"})
    charlie = await connector.data_writer.create_vertex("Person", {"name": "Charlie", "age": 35, "city": "NYC"})
    acme = await connector.data_writer.create_vertex("Company", {"name": "Acme Corp"})

    knows = await connector.data_writer.create_edge("KNOWS", alice.id, bob.id, {"since": 2020})
    knows2 = await connector.data_writer.create_edge("KNOWS", alice.id, charlie.id, {"since": 2018})
    works = await connector.data_writer.create_edge("WORKS_AT", alice.id, acme.id, {"role": "Engineer"})

    return {
        "alice": alice,
        "bob": bob,
        "charlie": charlie,
        "acme": acme,
        "knows_ab": knows,
        "knows_ac": knows2,
        "works_at": works,
    }


class TestReadVertices:
    async def test_read_all_by_label(self, connector, seeded_graph):
        people = await connector.data_reader.read_vertices("Person")
        assert len(people) == 3
        names = {v.properties["name"] for v in people}
        assert names == {"Alice", "Bob", "Charlie"}

    async def test_read_with_limit(self, connector, seeded_graph):
        people = await connector.data_reader.read_vertices("Person", limit=2)
        assert len(people) == 2

    async def test_read_with_offset_and_limit(self, connector, seeded_graph):
        page = await connector.data_reader.read_vertices("Person", limit=2, offset=1)
        assert len(page) == 2

    async def test_read_with_eq_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="name", op=FilterOp.EQ, value="Alice"),
            ]
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        assert len(people) == 1
        assert people[0].properties["name"] == "Alice"

    async def test_read_with_gt_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="age", op=FilterOp.GT, value=28),
            ]
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        assert len(people) == 2
        names = {v.properties["name"] for v in people}
        assert names == {"Alice", "Charlie"}

    async def test_read_with_and_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            operator=LogicalOp.AND,
            conditions=[
                FilterExpression(property="age", op=FilterOp.GT, value=20),
                FilterExpression(property="city", op=FilterOp.EQ, value="NYC"),
            ],
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        names = {v.properties["name"] for v in people}
        assert names == {"Alice", "Charlie"}

    async def test_read_with_or_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            operator=LogicalOp.OR,
            conditions=[
                FilterExpression(property="name", op=FilterOp.EQ, value="Alice"),
                FilterExpression(property="name", op=FilterOp.EQ, value="Bob"),
            ],
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        assert len(people) == 2

    async def test_read_with_contains_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="name", op=FilterOp.CONTAINS, value="li"),
            ]
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        assert len(people) == 2  # Alice, Charlie
        names = {v.properties["name"] for v in people}
        assert names == {"Alice", "Charlie"}

    async def test_read_with_starts_with_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="name", op=FilterOp.STARTS_WITH, value="A"),
            ]
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        assert len(people) == 1
        assert people[0].properties["name"] == "Alice"

    async def test_read_with_in_filter(self, connector, seeded_graph):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="city", op=FilterOp.IN, value=["NYC", "SF"]),
            ]
        )
        people = await connector.data_reader.read_vertices("Person", filters=filters)
        assert len(people) == 2

    async def test_read_nonexistent_label(self, connector, seeded_graph):
        result = await connector.data_reader.read_vertices("NonExistent")
        assert result == []


class TestReadVertexById:
    async def test_read_existing_vertex(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        vertex = await connector.data_reader.read_vertex_by_id(alice.id)
        assert vertex.id == alice.id
        assert vertex.properties["name"] == "Alice"

    async def test_vertex_preserves_properties(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        vertex = await connector.data_reader.read_vertex_by_id(alice.id)
        assert vertex.properties["age"] == 30
        assert vertex.properties["city"] == "NYC"


class TestReadEdges:
    async def test_read_all_edges_by_label(self, connector, seeded_graph):
        edges = await connector.data_reader.read_edges("KNOWS")
        assert len(edges) == 2

    async def test_read_edges_with_source_label(self, connector, seeded_graph):
        edges = await connector.data_reader.read_edges("WORKS_AT", source_label="Person")
        assert len(edges) == 1
        assert edges[0].label == "WORKS_AT"

    async def test_read_edges_with_both_labels(self, connector, seeded_graph):
        edges = await connector.data_reader.read_edges("WORKS_AT", source_label="Person", target_label="Company")
        assert len(edges) == 1

    async def test_read_edges_with_limit(self, connector, seeded_graph):
        edges = await connector.data_reader.read_edges("KNOWS", limit=1)
        assert len(edges) == 1

    async def test_edge_has_correct_endpoints(self, connector, seeded_graph):
        edges = await connector.data_reader.read_edges("WORKS_AT")
        assert len(edges) == 1
        assert edges[0].source == seeded_graph["alice"].id
        assert edges[0].target == seeded_graph["acme"].id


class TestReadEdgeById:
    async def test_read_existing_edge(self, connector, seeded_graph):
        knows = seeded_graph["knows_ab"]
        edge = await connector.data_reader.read_edge_by_id(knows.id)
        assert edge.id == knows.id
        assert edge.label == "KNOWS"
        assert edge.properties["since"] == 2020


class TestReadNeighbors:
    async def test_read_neighbors_both(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        response = await connector.data_reader.read_neighbors(alice.id)
        # Alice -> Bob, Alice -> Charlie, Alice -> Acme (3 edges, all outgoing)
        assert len(response.edges) == 3

    async def test_read_neighbors_out(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        response = await connector.data_reader.read_neighbors(alice.id, direction="out")
        assert len(response.edges) == 3

    async def test_read_neighbors_in(self, connector, seeded_graph):
        bob = seeded_graph["bob"]
        response = await connector.data_reader.read_neighbors(bob.id, direction="in")
        # Bob has one incoming KNOWS edge from Alice
        assert len(response.edges) == 1

    async def test_read_neighbors_with_edge_label(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        response = await connector.data_reader.read_neighbors(alice.id, edge_label="KNOWS")
        assert len(response.edges) == 2

    async def test_read_neighbors_with_limit(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        response = await connector.data_reader.read_neighbors(alice.id, limit=1)
        assert len(response.edges) == 1

    async def test_read_neighbors_no_connections(self, connector):
        isolated = await connector.data_writer.create_vertex("Isolated", {"name": "Lonely"})
        response = await connector.data_reader.read_neighbors(isolated.id)
        assert len(response.edges) == 0
        assert len(response.nodes) == 0


class TestExpandNeighbors:
    """RFC-035 node-expand: by-node-type / by-edge-type, sort, pagination, counts."""

    async def test_by_node_type(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        people = await connector.data_reader.read_neighbors_by_node_type(alice.id, neighbor_label="Person")
        companies = await connector.data_reader.read_neighbors_by_node_type(alice.id, neighbor_label="Company")
        assert len(people.edges) == 2  # Bob, Charlie
        assert len(companies.edges) == 1  # Acme

    async def test_by_edge_type_direction(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        works = await connector.data_reader.read_neighbors_by_edge_type(
            alice.id, edge_label="WORKS_AT", direction="out"
        )
        assert len(works.edges) == 1
        assert works.edges[0].label == "WORKS_AT"

    async def test_sorted_asc_vs_desc(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        asc = await connector.data_reader.read_neighbors_by_edge_type(
            alice.id, edge_label="KNOWS", sort=[SortSpec(property="name", direction=SortDirection.ASC)]
        )
        desc = await connector.data_reader.read_neighbors_by_edge_type(
            alice.id, edge_label="KNOWS", sort=[SortSpec(property="name", direction=SortDirection.DESC)]
        )
        asc_names = [n.properties["name"] for n in asc.nodes if n.id != alice.id]
        desc_names = [n.properties["name"] for n in desc.nodes if n.id != alice.id]
        assert asc_names == ["Bob", "Charlie"]
        assert desc_names == ["Charlie", "Bob"]

    async def test_pagination_disjoint(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        sort = [SortSpec(property="name", direction=SortDirection.ASC)]
        page1 = await connector.data_reader.read_neighbors_by_edge_type(
            alice.id, edge_label="KNOWS", sort=sort, limit=1, offset=0
        )
        page2 = await connector.data_reader.read_neighbors_by_edge_type(
            alice.id, edge_label="KNOWS", sort=sort, limit=1, offset=1
        )
        p1 = [n.properties["name"] for n in page1.nodes if n.id != alice.id]
        p2 = [n.properties["name"] for n in page2.nodes if n.id != alice.id]
        assert p1 == ["Bob"]
        assert p2 == ["Charlie"]

    async def test_counts(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        assert await connector.data_reader.count_neighbors(alice.id) == 3
        assert await connector.data_reader.count_neighbors_by_edge_type(alice.id, edge_label="KNOWS") == 2
        assert await connector.data_reader.count_neighbors_by_node_type(alice.id, neighbor_label="Person") == 2

    async def test_filter_narrows_count(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        # Of Alice's KNOWS neighbours (Bob 25, Charlie 35), only Charlie is > 30.
        filters = FilterGroup(conditions=[FilterExpression(property="age", op=FilterOp.GT, value=30)])
        count = await connector.data_reader.count_neighbors_by_edge_type(alice.id, edge_label="KNOWS", filters=filters)
        assert count == 1


class TestShortestPath:
    async def test_shortest_path_direct(self, connector, seeded_graph):
        alice = seeded_graph["alice"]
        bob = seeded_graph["bob"]
        path = await connector.data_reader.shortest_path(alice.id, bob.id)
        assert path is not None
        assert len(path.vertices) == 2
        assert len(path.edges) == 0  # Gremlin path() returns vertices only by default

    async def test_shortest_path_no_connection(self, connector, seeded_graph):
        bob = seeded_graph["bob"]
        isolated = await connector.data_writer.create_vertex("Isolated", {"name": "Solo"})
        path = await connector.data_reader.shortest_path(bob.id, isolated.id)
        assert path is None


class TestCountVertices:
    async def test_count_by_label(self, connector, seeded_graph):
        count = await connector.data_reader.count_vertices("Person")
        assert count == 3

    async def test_count_all(self, connector, seeded_graph):
        count = await connector.data_reader.count_vertices()
        assert count == 4  # 3 Person + 1 Company


class TestCountEdges:
    async def test_count_by_label(self, connector, seeded_graph):
        count = await connector.data_reader.count_edges("KNOWS")
        assert count == 2

    async def test_count_all(self, connector, seeded_graph):
        count = await connector.data_reader.count_edges()
        assert count == 3  # 2 KNOWS + 1 WORKS_AT
