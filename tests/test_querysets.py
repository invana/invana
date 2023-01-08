from invana import InvanaGraph
from invana.serializer.element_structure import Node, RelationShip


class TestVertexQuerySet:

    def test_create(self, graph: InvanaGraph):
        vtx = graph.connector.vertex.create("Person", name="Ravi").to_list()
        assert isinstance(vtx[0], Node)

    def test_search(self, graph: InvanaGraph):
        vtx = graph.connector.vertex.search(has__label="GithubProject", has__name="invana-engine").to_list()
        assert isinstance(vtx[0], Node)

    # def test_update(self, graph: InvanaGraph):
    #     vtx = graph.vertex.search(has__label="GithubProject", has__name="invana-engine").update_proper.element_map()
    #     assert isinstance(vtx[0], Node)
