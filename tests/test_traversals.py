from invana.gremlin.connector import GremlinConnector
from invana.serializer.element_structure import RelationShip, Node


class TestSearchTraversal:

    def test_simple_search(self, connection: GremlinConnector):
        result = connection.g.V().search(has__name="invana engine").elementMap().toList()
        assert result[0].properties.name == "invana engine"

    def test_has_name_search(self, connection: GremlinConnector):
        result = connection.g.V().search(has__name__startingWith="invana").elementMap().toList()
        assert result.__len__() == 3

    def test_has_label_within(self, connection: GremlinConnector):
        result = connection.g.V().search(has__label__within=["User", "Project"]).elementMap().toList()
        assert result.__len__() == 3

    def test_advanced_search(self, connection: GremlinConnector):
        result = connection.g.V().search(has__label="Project",
                                         has__name__startingWith="invana"
                                         ).elementMap().toList()
        assert result.__len__() == 2


class TestCreateTraversal:

    def test_vertex_create(self, connection: GremlinConnector):
        result = connection.g.create_vertex("NewLabel", name="Hi Label").next()
        result = connection.g.V().search(has__id=result.id).elementMap().next()
        assert isinstance(result, Node)
        assert result.properties.name == "Hi Label"

    def test_edge_create(self, connection: GremlinConnector):
        node1 = connection.g.create_vertex("NewLabel", name="Hi Label 1").next()
        node2 = connection.g.create_vertex("NewLabel", name="Hi Label 2").next()
        connection.g.create_edge("has_link", node1.id, node2.id, name="Hi Edge 1").next()
        result = connection.g.E().search(has__name="Hi Edge 1").elementMap().next()
        assert isinstance(result, RelationShip)
        assert result.properties.name == "Hi Edge 1"
