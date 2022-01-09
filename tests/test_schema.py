from invana_py import InvanaGraph


class TestSchema:
    def test_read_vertex_labels(self, graph: InvanaGraph):
        result = graph.backend.schema_reader._get_graph_schema_overview()
        print(result)
