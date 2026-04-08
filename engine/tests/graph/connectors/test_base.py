"""Tests for base data types, constants, exceptions, and decorators."""

import pytest

from invana.graph.connectors.base.constants import Capability, QueryLanguage
from invana.graph.connectors.base.data_types.data_elements import (
    Edge,
    GraphResponse,
    Path,
    QueryResult,
    ResultMetadata,
    Vertex,
)
from invana.graph.connectors.base.data_types.filter_types import FilterOp
from invana.graph.connectors.base.data_types.filters import FilterExpression, FilterGroup, LogicalOp
from invana.graph.connectors.base.data_types.schema_elements import (
    ConstraintInfo,
    EdgeType,
    IndexInfo,
    NodeType,
    PropertyDefinition,
)
from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.exceptions import (
    ConnectionError,
    ConnectorError,
    NotSupportedError,
    QueryExecutionError,
    SerializationError,
)

# -- Constants --


class TestConstants:
    def test_query_language_values(self):
        assert QueryLanguage.CYPHER == "cypher"
        assert QueryLanguage.GREMLIN == "gremlin"

    def test_capability_values(self):
        assert Capability.CYPHER == "cypher"
        assert Capability.VECTOR_SEARCH == "vector_search"
        assert Capability.TRANSACTIONS == "transactions"


# -- Exceptions --


class TestExceptions:
    def test_hierarchy(self):
        assert issubclass(ConnectionError, ConnectorError)
        assert issubclass(QueryExecutionError, ConnectorError)
        assert issubclass(NotSupportedError, ConnectorError)
        assert issubclass(SerializationError, ConnectorError)

    def test_connector_error_message(self):
        err = ConnectorError("test error")
        assert str(err) == "test error"

    def test_not_supported_error(self):
        with pytest.raises(NotSupportedError):
            raise NotSupportedError("feature X not supported")


# -- Decorators --


class TestDecorators:
    @pytest.mark.asyncio
    async def test_not_supported_by_vendor(self):
        @not_supported_by_vendor("No vector support.")
        async def my_method(self):
            return "should not reach"

        with pytest.raises(NotSupportedError, match="'my_method' is not supported"):
            await my_method(None)

    @pytest.mark.asyncio
    async def test_not_supported_includes_custom_message(self):
        @not_supported_by_vendor("Custom reason here.")
        async def another_method(self):
            pass

        with pytest.raises(NotSupportedError, match="Custom reason here"):
            await another_method(None)


# -- Data Elements --


class TestDataElements:
    def test_vertex_creation(self):
        v = Vertex(id="1", label="Person", properties={"name": "Alice"})
        assert v.id == "1"
        assert v.label == "Person"
        assert v.properties == {"name": "Alice"}

    def test_vertex_defaults(self):
        v = Vertex(id="1", label="Person")
        assert v.properties == {}

    def test_edge_creation(self):
        e = Edge(id="1", label="KNOWS", source="a", target="b", properties={"since": 2020})
        assert e.source == "a"
        assert e.target == "b"
        assert e.properties["since"] == 2020

    def test_path_creation(self):
        v1 = Vertex(id="1", label="A")
        v2 = Vertex(id="2", label="B")
        e = Edge(id="e1", label="LINK", source="1", target="2")
        p = Path(vertices=[v1, v2], edges=[e])
        assert len(p.vertices) == 2
        assert len(p.edges) == 1

    def test_result_metadata_defaults(self):
        m = ResultMetadata()
        assert m.node_count == 0
        assert m.duration_ms == 0.0

    def test_graph_response_defaults(self):
        gr = GraphResponse()
        assert gr.nodes == []
        assert gr.edges == []
        assert gr.records == []
        assert gr.metadata.node_count == 0

    def test_query_result_completed(self):
        qr = QueryResult(
            id="q1",
            status="completed",
            duration_ms=12.5,
            language="cypher",
            result=GraphResponse(),
        )
        assert qr.status == "completed"
        assert qr.error is None

    def test_query_result_error(self):
        qr = QueryResult(
            id="q2",
            status="error",
            duration_ms=1.0,
            language="cypher",
            error="Syntax error",
        )
        assert qr.status == "error"
        assert qr.result is None


# -- Schema Elements --


class TestSchemaElements:
    def test_property_definition(self):
        p = PropertyDefinition(name="age", type="integer", required=True)
        assert p.name == "age"
        assert p.required is True
        assert p.unique is False

    def test_node_type(self):
        nt = NodeType(
            name="Person",
            properties=[PropertyDefinition(name="name", type="string")],
        )
        assert nt.name == "Person"
        assert len(nt.properties) == 1

    def test_edge_type(self):
        et = EdgeType(name="KNOWS", source="Person", target="Person")
        assert et.cardinality == "many-to-many"

    def test_index_info(self):
        idx = IndexInfo(name="idx_name", label="Person", properties=["name"], type="btree")
        assert idx.type == "btree"

    def test_constraint_info(self):
        cst = ConstraintInfo(name="cst_email", label="User", properties=["email"], type="unique")
        assert cst.type == "unique"


# -- Filters --


class TestFilters:
    def test_filter_expression(self):
        expr = FilterExpression(property="age", op=FilterOp.GT, value=25)
        assert expr.op == FilterOp.GT
        assert expr.value == 25

    def test_filter_op_values(self):
        assert FilterOp.EQ == "eq"
        assert FilterOp.CONTAINS == "contains"
        assert FilterOp.IS_NULL == "is_null"

    def test_simple_filter_group(self):
        group = FilterGroup(
            operator=LogicalOp.AND,
            conditions=[
                FilterExpression(property="age", op=FilterOp.GT, value=20),
                FilterExpression(property="name", op=FilterOp.STARTS_WITH, value="A"),
            ],
        )
        assert len(group.conditions) == 2
        assert group.operator == LogicalOp.AND

    def test_nested_filter_group(self):
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
        assert filters.operator == LogicalOp.OR
        assert len(filters.conditions) == 2
        assert isinstance(filters.conditions[0], FilterGroup)
        assert isinstance(filters.conditions[1], FilterExpression)

    def test_empty_filter_group(self):
        group = FilterGroup()
        assert group.operator == LogicalOp.AND
        assert group.conditions == []
