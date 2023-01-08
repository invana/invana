from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from invana import InvanaGraph
import random


class TestSchema:

    def test_get_graph_schema(self, graph: InvanaGraph):
        label = "UserProfile"
        graph.vertex.create(label, name="Ravi {random.randint(1, 1000)}").to_list()
        result = graph.connector.management.schema_reader.get_graph_schema()
        assert label in list(result['vertices'].keys())
        assert "name" in list(result['vertices'][label].properties.keys())
        assert "other_property" not in list(result['vertices'][label].properties.keys())
        # assert ["name"] in list(result['vertices'][label])

    def test_read_vertex_labels(self, graph: InvanaGraph):
        label = "UserProfile"
        graph.vertex.create(label, name=f"Ravi {random.randint(1, 1000)}").to_list()
        result = graph.connector.management.schema_reader.get_vertex_schema(label)
        assert label == result.name
        assert "name" in list(result.properties.keys())
        assert "other_property" not in list(result.properties.keys())

    def test_read_edge_labels(self, graph: InvanaGraph):
        label = "authored"
        result = graph.connector.management.schema_reader.get_edge_schema(label)
        assert label == result.name
        assert "started" in list(result.properties.keys())
        assert "other_property" not in list(result.properties.keys())
