from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from invana.gremlin.connector import GremlinConnector
from invana.serializer.element_structure import RelationShip, Node
import pytest

class TestSearchTraversal:

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_simple_search(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        result = connector.g.V().search(has__name="invana engine").elementMap().toList()
        assert result[0].properties.name == "invana engine"

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_has_name_search(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        result = connector.g.V().search(has__name__startingWith="invana").elementMap().toList()
        assert result.__len__() == 3

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_has_label_within(self, connectors_store, connector_name):
        connector = connectors_store[connector_name]
        result = connector.g.V().search(has__label__within=["User", "Project"]).elementMap().toList()
        assert result.__len__() == 3

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_advanced_search(self,  connectors_store, connector_name):
        connector = connectors_store[connector_name]
        result = connector.g.V().search(has__label="Project",
                                         has__name__startingWith="invana"
                                         ).elementMap().toList()
        assert result.__len__() == 2


class TestCreateTraversal:

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_vertex_create(self,  connectors_store, connector_name):
        connector = connectors_store[connector_name]
        result = connector.g.create_vertex("NewLabel", name="Hi Label").next()
        result = connector.g.V().search(has__id=result.id).elementMap().next()
        assert isinstance(result, Node)
        assert result.properties.name == "Hi Label"

    @pytest.mark.parametrize("connector_name", ["gremlin_connector", "janusgraph_connector"])
    def test_edge_create(self,  connectors_store, connector_name):
        connector = connectors_store[connector_name]
        node1 = connector.g.create_vertex("NewLabel", name="Hi Label 1").next()
        node2 = connector.g.create_vertex("NewLabel", name="Hi Label 2").next()
        connector.g.create_edge("has_link", node1.id, node2.id, name="Hi Edge 1").next()
        result = connector.g.E().search(has__name="Hi Edge 1").elementMap().next()
        assert isinstance(result, RelationShip)
        assert result.properties.name == "Hi Edge 1"
