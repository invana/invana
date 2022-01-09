from invana_py import InvanaGraph
import random


class TestSchema:
    def test_get_graph_schema(self, graph: InvanaGraph):
        label = f"UserProfile"
        graph.vertex.create(label, name=f"Ravi {random.randint(1, 1000)}").element_map()
        result = graph.backend.schema_reader.get_graph_schema()
        assert label in list(result['vertices'].keys())
        assert "name" in list(result['vertices'][label].properties.keys())
        assert "other_property" not in list(result['vertices'][label].properties.keys())
        # assert ["name"] in list(result['vertices'][label])

    def test_read_vertex_labels(self, graph: InvanaGraph):
        label = f"UserProfile"
        graph.vertex.create(label, name=f"Ravi {random.randint(1, 1000)}").element_map()
        result = graph.backend.schema_reader.get_vertex_schema(label)
        assert label == result.name
        assert "name" in list(result.properties.keys())
        assert "other_property" not in list(result.properties.keys())
