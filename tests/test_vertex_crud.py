from invana_py.connector.connector import GremlinConnector
from invana_py.serializer.structure import RelationShip, Node


class TestVertexCRUD:

    def test_vertex_create(self, connection: GremlinConnector):
        result = connection.g.create_vertex("NewLabel", name="Hi Label").next()
        result = connection.g.V().search(has__id=result.id).elementMap().next()
        assert isinstance(result, Node)
        assert result.properties.name == "Hi Label"
