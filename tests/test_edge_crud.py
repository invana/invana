from invana_py.connector.connector import GremlinConnector
from invana_py.serializer.structure import RelationShip, Node


class TestEdgeCRUD:

    def test_edge_create(self, connection: GremlinConnector):
        node1 = connection.g.create_vertex("NewLabel", name="Hi Label 1").next()
        node2 = connection.g.create_vertex("NewLabel", name="Hi Label 2").next()
        connection.g.create_edge("has_link", node1.id, node2.id, name="Hi Edge 1").next()
        result = connection.g.E().search(has__name="Hi Edge 1").elementMap().next()
        assert isinstance(result, RelationShip)
        assert result.properties.name == "Hi Edge 1"
