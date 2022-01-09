from invana_py import InvanaGraph
from invana_py.serializer.element_structure import Node, RelationShip


class TestVertexQuerySet:

    def test_create(self, graph: InvanaGraph):
        vtx = graph.vertex.create("Person", name="Ravi").element_map()
        assert isinstance(vtx[0], Node)

    def test_search(self, graph: InvanaGraph):
        vtx = graph.vertex.search(has__label="GithubProject", has__name="invana-engine").element_map()
        assert isinstance(vtx[0], Node)

    # def test_update(self, graph: InvanaGraph):
    #     vtx = graph.vertex.search(has__label="GithubProject", has__name="invana-engine").update_proper.element_map()
    #     assert isinstance(vtx[0], Node)
