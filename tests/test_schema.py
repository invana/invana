from invana_py import InvanaGraph
import random


class TestSchema:
    def test_read_vertex_labels(self, graph: InvanaGraph):
        label = f"UserProfile {random.randint(1, 1000)}"
        graph.vertex.create(label, name=f"Ravi {random.randint(1, 1000)}").element_map()
        result = graph.backend.schema_reader.get_graph_schema()
        assert label in list(result['vertices'].keys())
        assert "name" in list(result['vertices'][label].properties.keys())
        assert "other_property" not in list(result['vertices'][label].properties.keys())
        # assert ["name"] in list(result['vertices'][label])
