"""Tests for the OpenCypher query builder — validates generated Cypher and parameters."""

from invana.graph.connectors.base.data_types.filter_types import FilterOp
from invana.graph.connectors.base.data_types.filters import FilterExpression, FilterGroup, LogicalOp
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder


class TestMatchNodes:
    def test_simple_match(self):
        query, params = OpenCypherQueryBuilder.match_nodes("Person")
        assert query == "MATCH (n:`Person`) RETURN n"
        assert params == {}

    def test_match_with_limit(self):
        query, params = OpenCypherQueryBuilder.match_nodes("Person", limit=25)
        assert "LIMIT $p0" in query
        assert params["p0"] == 25

    def test_match_with_offset_and_limit(self):
        query, params = OpenCypherQueryBuilder.match_nodes("Person", limit=10, offset=20)
        assert "SKIP $p0" in query
        assert "LIMIT $p1" in query
        assert params["p0"] == 20
        assert params["p1"] == 10

    def test_match_with_eq_filter(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="name", op=FilterOp.EQ, value="Alice"),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        assert "WHERE n.name = $p0" in query
        assert params["p0"] == "Alice"

    def test_match_with_gt_filter(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="age", op=FilterOp.GT, value=25),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        assert "WHERE n.age > $p0" in query
        assert params["p0"] == 25

    def test_match_with_and_filters(self):
        filters = FilterGroup(
            operator=LogicalOp.AND,
            conditions=[
                FilterExpression(property="age", op=FilterOp.GT, value=20),
                FilterExpression(property="name", op=FilterOp.STARTS_WITH, value="A"),
            ],
        )
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        assert "n.age > $p0" in query
        assert "n.name STARTS WITH $p1" in query
        assert " AND " in query
        assert params["p0"] == 20
        assert params["p1"] == "A"

    def test_match_with_or_filters(self):
        filters = FilterGroup(
            operator=LogicalOp.OR,
            conditions=[
                FilterExpression(property="age", op=FilterOp.LT, value=18),
                FilterExpression(property="age", op=FilterOp.GT, value=65),
            ],
        )
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        assert "n.age < $p0" in query
        assert "n.age > $p1" in query
        assert " OR " in query

    def test_match_with_nested_filters(self):
        """(born > 1990 AND name STARTS_WITH 'A') OR (born < 1950)"""
        filters = FilterGroup(
            operator=LogicalOp.OR,
            conditions=[
                FilterGroup(
                    operator=LogicalOp.AND,
                    conditions=[
                        FilterExpression(property="born", op=FilterOp.GT, value=1990),
                        FilterExpression(property="name", op=FilterOp.STARTS_WITH, value="A"),
                    ],
                ),
                FilterExpression(property="born", op=FilterOp.LT, value=1950),
            ],
        )
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        # Should have nested parentheses
        assert "(n.born > $p0 AND n.name STARTS WITH $p1)" in query
        assert "n.born < $p2" in query
        assert " OR " in query

    def test_match_with_in_filter(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="status", op=FilterOp.IN, value=["active", "pending"]),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("User", filters=filters)
        assert "n.status IN $p0" in query
        assert params["p0"] == ["active", "pending"]

    def test_match_with_not_in_filter(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="status", op=FilterOp.NOT_IN, value=["deleted"]),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("User", filters=filters)
        assert "NOT n.status IN $p0" in query

    def test_match_with_contains_filter(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="bio", op=FilterOp.CONTAINS, value="engineer"),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("User", filters=filters)
        assert "n.bio CONTAINS $p0" in query

    def test_match_with_ends_with_filter(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="email", op=FilterOp.ENDS_WITH, value="@gmail.com"),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("User", filters=filters)
        assert "n.email ENDS WITH $p0" in query

    def test_match_with_null_checks(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="deleted_at", op=FilterOp.IS_NULL),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("User", filters=filters)
        assert "n.deleted_at IS NULL" in query

    def test_match_with_is_not_null(self):
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="email", op=FilterOp.IS_NOT_NULL),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("User", filters=filters)
        assert "n.email IS NOT NULL" in query

    def test_match_with_empty_filter_group(self):
        filters = FilterGroup()
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        assert "WHERE" not in query


class TestMatchEdges:
    def test_simple_match(self):
        query, params = OpenCypherQueryBuilder.match_edges("KNOWS")
        assert "MATCH (a)-[r:`KNOWS`]->(b)" in query
        assert "RETURN r, a, b" in query

    def test_match_with_source_label(self):
        query, params = OpenCypherQueryBuilder.match_edges("KNOWS", source_label="Person")
        assert "(a:`Person`)" in query

    def test_match_with_both_labels(self):
        query, params = OpenCypherQueryBuilder.match_edges("WORKS_AT", source_label="Person", target_label="Company")
        assert "(a:`Person`)" in query
        assert "(b:`Company`)" in query

    def test_match_with_limit(self):
        query, params = OpenCypherQueryBuilder.match_edges("KNOWS", limit=50)
        assert "LIMIT $p0" in query
        assert params["p0"] == 50


class TestMatchNeighbors:
    def test_both_direction(self):
        query, params = OpenCypherQueryBuilder.match_neighbors("v1")
        assert "(n)-[r]-(m)" in query
        assert params["vid"] == "v1"

    def test_out_direction(self):
        query, params = OpenCypherQueryBuilder.match_neighbors("v1", direction="out")
        assert "(n)-[r]->(m)" in query

    def test_in_direction(self):
        query, params = OpenCypherQueryBuilder.match_neighbors("v1", direction="in")
        assert "(n)<-[r]-(m)" in query

    def test_with_edge_label(self):
        query, params = OpenCypherQueryBuilder.match_neighbors("v1", edge_label="KNOWS")
        assert "[r:`KNOWS`]" in query

    def test_with_limit(self):
        query, params = OpenCypherQueryBuilder.match_neighbors("v1", limit=10)
        assert "LIMIT $p0" in query
        assert params["p0"] == 10


class TestCRUD:
    def test_match_node_by_id(self):
        query, params = OpenCypherQueryBuilder.match_node_by_id("abc123")
        assert "elementId(n) = $vid" in query
        assert params["vid"] == "abc123"

    def test_match_edge_by_id(self):
        query, params = OpenCypherQueryBuilder.match_edge_by_id("edge1")
        assert "elementId(r) = $eid" in query
        assert params["eid"] == "edge1"

    def test_create_node(self):
        query, params = OpenCypherQueryBuilder.create_node("Person", {"name": "Alice", "age": 30})
        assert "CREATE (n:`Person` $props)" in query
        assert params["props"] == {"name": "Alice", "age": 30}

    def test_create_edge_with_properties(self):
        query, params = OpenCypherQueryBuilder.create_edge("KNOWS", "a1", "b1", {"since": 2020})
        assert "CREATE (a)-[r:`KNOWS` $props]->(b)" in query
        assert params["sid"] == "a1"
        assert params["tid"] == "b1"
        assert params["props"] == {"since": 2020}

    def test_create_edge_without_properties(self):
        query, params = OpenCypherQueryBuilder.create_edge("KNOWS", "a1", "b1")
        assert "$props" not in query
        assert "props" not in params

    def test_update_node(self):
        query, params = OpenCypherQueryBuilder.update_node("v1", {"age": 31})
        assert "SET n += $props" in query
        assert params["vid"] == "v1"
        assert params["props"] == {"age": 31}

    def test_update_edge(self):
        query, params = OpenCypherQueryBuilder.update_edge("e1", {"weight": 0.5})
        assert "SET r += $props" in query
        assert params["eid"] == "e1"

    def test_delete_node(self):
        query, params = OpenCypherQueryBuilder.delete_node("v1")
        assert "DETACH DELETE n" in query
        assert params["vid"] == "v1"

    def test_delete_edge(self):
        query, params = OpenCypherQueryBuilder.delete_edge("e1")
        assert "DELETE r" in query
        assert params["eid"] == "e1"


class TestCount:
    def test_count_nodes_with_label(self):
        query, params = OpenCypherQueryBuilder.count_nodes("Person")
        assert "MATCH (n:`Person`)" in query
        assert "count(n) AS cnt" in query

    def test_count_nodes_all(self):
        query, params = OpenCypherQueryBuilder.count_nodes()
        assert "MATCH (n)" in query
        assert "`" not in query

    def test_count_edges_with_label(self):
        query, params = OpenCypherQueryBuilder.count_edges("KNOWS")
        assert "[r:`KNOWS`]" in query

    def test_count_edges_all(self):
        query, params = OpenCypherQueryBuilder.count_edges()
        assert "MATCH ()-[r]->()" in query


class TestShortestPath:
    def test_shortest_path(self):
        query, params = OpenCypherQueryBuilder.shortest_path("a1", "b1", max_depth=5)
        assert "shortestPath" in query
        assert "*..5" in query
        assert params["sid"] == "a1"
        assert params["tid"] == "b1"


class TestBulk:
    def test_bulk_create_nodes(self):
        records = [{"name": "A"}, {"name": "B"}]
        query, params = OpenCypherQueryBuilder.bulk_create_nodes("Person", records)
        assert "UNWIND $records" in query
        assert "CREATE (n:`Person`)" in query
        assert params["records"] == records

    def test_bulk_create_edges(self):
        records = [{"source_id": "a", "target_id": "b", "properties": {"w": 1}}]
        query, params = OpenCypherQueryBuilder.bulk_create_edges("KNOWS", records)
        assert "UNWIND $records" in query
        assert "rec.source_id" in query
        assert "rec.target_id" in query

    def test_bulk_delete_nodes(self):
        query, params = OpenCypherQueryBuilder.bulk_delete_nodes(["v1", "v2"])
        assert "UNWIND $ids" in query
        assert "DETACH DELETE n" in query
        assert params["ids"] == ["v1", "v2"]

    def test_bulk_delete_edges(self):
        query, params = OpenCypherQueryBuilder.bulk_delete_edges(["e1", "e2"])
        assert "UNWIND $ids" in query
        assert "DELETE r" in query


class TestSchema:
    def test_get_node_labels(self):
        query, params = OpenCypherQueryBuilder.get_node_labels()
        assert "db.labels()" in query
        assert params == {}

    def test_get_edge_labels(self):
        query, params = OpenCypherQueryBuilder.get_edge_labels()
        assert "db.relationshipTypes()" in query

    def test_get_property_keys(self):
        query, params = OpenCypherQueryBuilder.get_property_keys("Person")
        assert "MATCH (n:`Person`)" in query
        assert "keys(n)" in query
        assert "DISTINCT" in query


class TestParameterization:
    """Ensure all queries use parameterized values — no raw string interpolation of user data."""

    def test_filter_values_parameterized(self):
        """User-provided filter values must be parameters, not interpolated."""
        filters = FilterGroup(
            conditions=[
                FilterExpression(property="name", op=FilterOp.EQ, value="'; DROP TABLE users; --"),
            ]
        )
        query, params = OpenCypherQueryBuilder.match_nodes("Person", filters=filters)
        # The malicious string should NOT appear in the query
        assert "DROP TABLE" not in query
        # It should be in the parameters
        assert params["p0"] == "'; DROP TABLE users; --"

    def test_node_ids_parameterized(self):
        query, params = OpenCypherQueryBuilder.match_node_by_id("test-id")
        assert "test-id" not in query
        assert params["vid"] == "test-id"
