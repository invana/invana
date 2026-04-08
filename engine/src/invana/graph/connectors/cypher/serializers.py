"""OpenCypher serializer — converts Bolt protocol records to Pydantic models.

This serializer handles the standard Bolt record format used by Neo4j and
Memgraph drivers. Integration packages can subclass if their driver returns
a different raw format.
"""

from __future__ import annotations

from typing import Any

from invana.graph.connectors.base.data_types.data_elements import Edge, GraphResponse, Path, ResultMetadata, Vertex
from invana.graph.connectors.base.exceptions import SerializationError
from invana.graph.connectors.base.serializers import BaseSerializer


class OpenCypherSerializer(BaseSerializer):
    """Concrete serializer for Bolt protocol records.

    Expects raw data in the format returned by neo4j-python-driver:
    - Nodes: objects with element_id, labels, items() or _properties
    - Relationships: objects with element_id, type, start_node/end_node element_id, items() or _properties
    - Paths: objects with nodes and relationships attributes
    """

    def deserialize_vertex(self, raw: Any) -> Vertex:
        if raw is None:
            raise SerializationError("Cannot deserialize vertex from None")
        try:
            # neo4j-python-driver Node objects
            element_id = str(self._get_element_id(raw))
            label = self._get_node_label(raw)
            properties = self._get_properties(raw)
            return Vertex(id=element_id, label=label, properties=properties)
        except SerializationError:
            raise
        except Exception as e:
            raise SerializationError(f"Failed to deserialize vertex: {e}") from e

    def deserialize_edge(self, raw: Any, source_raw: Any = None, target_raw: Any = None) -> Edge:
        try:
            element_id = str(self._get_element_id(raw))
            label = self._get_edge_label(raw)
            properties = self._get_properties(raw)

            # Get source/target IDs from the relationship or from provided nodes
            if source_raw is not None:
                source = str(self._get_element_id(source_raw))
            else:
                source = str(self._get_start_node_element_id(raw))

            if target_raw is not None:
                target = str(self._get_element_id(target_raw))
            else:
                target = str(self._get_end_node_element_id(raw))

            return Edge(id=element_id, label=label, source=source, target=target, properties=properties)
        except Exception as e:
            raise SerializationError(f"Failed to deserialize edge: {e}") from e

    def deserialize_path(self, raw: Any) -> Path:
        try:
            nodes = [self.deserialize_vertex(node) for node in raw.nodes]
            edges = []
            for rel in raw.relationships:
                edges.append(self.deserialize_edge(rel))
            return Path(vertices=nodes, edges=edges)
        except Exception as e:
            raise SerializationError(f"Failed to deserialize path: {e}") from e

    def deserialize_graph_response(self, raw: Any) -> GraphResponse:
        nodes: list[Vertex] = []
        edges: list[Edge] = []
        records: list[dict[str, Any]] = []

        if not raw:
            return GraphResponse(nodes=nodes, edges=edges, records=records)

        for record in raw:
            record_dict: dict[str, Any] = {}
            for key in record.keys():  # noqa: SIM118 — record is a Bolt Record, not a dict
                value = record[key]
                if self._is_node(value):
                    vertex = self.deserialize_vertex(value)
                    nodes.append(vertex)
                    record_dict[key] = vertex.model_dump()
                elif self._is_relationship(value):
                    edge = self.deserialize_edge(value)
                    edges.append(edge)
                    record_dict[key] = edge.model_dump()
                elif self._is_path(value):
                    path = self.deserialize_path(value)
                    nodes.extend(path.vertices)
                    edges.extend(path.edges)
                    record_dict[key] = path.model_dump()
                else:
                    record_dict[key] = value
            records.append(record_dict)

        metadata = ResultMetadata(
            node_count=len(nodes),
            edge_count=len(edges),
            record_count=len(records),
        )
        return GraphResponse(nodes=nodes, edges=edges, records=records, metadata=metadata)

    # -- Extraction helpers (overridable by integrations if raw format differs) --

    def _get_element_id(self, raw: Any) -> str:
        if hasattr(raw, "element_id"):
            return raw.element_id
        if isinstance(raw, dict):
            return raw.get("element_id", raw.get("id", ""))
        return str(getattr(raw, "id", ""))

    def _get_node_label(self, raw: Any) -> str:
        if hasattr(raw, "labels"):
            labels = raw.labels
            if labels:
                return next(iter(labels))
        if isinstance(raw, dict):
            labels = raw.get("labels", [])
            if labels:
                return labels[0]
        return ""

    def _get_edge_label(self, raw: Any) -> str:
        if hasattr(raw, "type"):
            return raw.type
        if isinstance(raw, dict):
            return raw.get("type", "")
        return ""

    def _get_properties(self, raw: Any) -> dict[str, Any]:
        # Plain dict format: check "properties" key first
        if isinstance(raw, dict):
            return raw.get("properties", {})
        # neo4j driver: node._properties
        if hasattr(raw, "_properties"):
            return dict(raw._properties)
        # neo4j driver: dict(node) via items()
        if hasattr(raw, "items"):
            try:
                return dict(raw.items())
            except TypeError:
                pass
        return {}

    def _get_start_node_element_id(self, raw: Any) -> str:
        if hasattr(raw, "start_node") and hasattr(raw.start_node, "element_id"):
            return raw.start_node.element_id
        if hasattr(raw, "_start_node_element_id"):
            return raw._start_node_element_id
        if isinstance(raw, dict):
            return raw.get("start_node_element_id", "")
        return ""

    def _get_end_node_element_id(self, raw: Any) -> str:
        if hasattr(raw, "end_node") and hasattr(raw.end_node, "element_id"):
            return raw.end_node.element_id
        if hasattr(raw, "_end_node_element_id"):
            return raw._end_node_element_id
        if isinstance(raw, dict):
            return raw.get("end_node_element_id", "")
        return ""

    def _is_node(self, value: Any) -> bool:
        if hasattr(value, "labels") and hasattr(value, "element_id"):
            return True
        return isinstance(value, dict) and "labels" in value

    def _is_relationship(self, value: Any) -> bool:
        if hasattr(value, "type") and hasattr(value, "element_id") and not hasattr(value, "labels"):
            return True
        return isinstance(value, dict) and "type" in value and "labels" not in value

    def _is_path(self, value: Any) -> bool:
        return hasattr(value, "nodes") and hasattr(value, "relationships")
