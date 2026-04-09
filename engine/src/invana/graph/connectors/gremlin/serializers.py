"""Gremlin serializer — converts Gremlin traversal results to Pydantic models.

This serializer handles the elementMap() format returned by the Gremlin
Python driver. Integration packages can subclass if their driver returns
a different raw format.
"""

from __future__ import annotations

from typing import Any

from gremlin_python.process.traversal import T

from invana.graph.connectors.base.exceptions import SerializationError
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.types.data_elements import Edge, GraphResponse, Path, ResultMetadata, Vertex


class GremlinSerializer(BaseSerializer):
    """Concrete serializer for Gremlin elementMap() results.

    Expects raw data in the format returned by gremlinpython:
    - Vertices: dict with T.id, T.label, plus property keys
    - Edges: dict with T.id, T.label, Direction.IN, Direction.OUT, plus property keys
    """

    def deserialize_vertex(self, raw: Any) -> Vertex:
        """Convert a Gremlin elementMap result to a Vertex."""
        if raw is None:
            raise SerializationError("Cannot deserialize vertex from None")
        try:
            element_id = str(self._extract_id(raw))
            label = self._extract_label(raw)
            properties = self._extract_properties(raw)
            return Vertex(id=element_id, label=label, properties=properties)
        except SerializationError:
            raise
        except Exception as e:
            raise SerializationError(f"Failed to deserialize vertex: {e}") from e

    def deserialize_edge(self, raw: Any, source_raw: Any = None, target_raw: Any = None) -> Edge:
        """Convert a Gremlin result to an Edge.

        Accepts either:
        - A projected dict with 'eid', 'elabel', 'eprops', 'source', 'target' keys
          (from the _project_edge helper).
        - A legacy elementMap dict with T.id, T.label, Direction keys.
        """
        try:
            # New project-based format from _project_edge
            if isinstance(raw, dict) and "eid" in raw:
                element_id = str(raw["eid"])
                label = raw["elabel"]
                properties = dict(raw.get("eprops", {}))
                source_map = raw.get("source", source_raw)
                target_map = raw.get("target", target_raw)
                source = str(self._extract_id(source_map)) if source_map else ""
                target = str(self._extract_id(target_map)) if target_map else ""
                return Edge(id=element_id, label=label, source=source, target=target, properties=properties)

            # Legacy elementMap format
            element_id = str(self._extract_id(raw))
            label = self._extract_label(raw)
            properties = self._extract_properties(raw)

            if source_raw is not None:
                source = str(self._extract_id(source_raw))
            else:
                source = str(self._extract_edge_endpoint(raw, "OUT"))

            if target_raw is not None:
                target = str(self._extract_id(target_raw))
            else:
                target = str(self._extract_edge_endpoint(raw, "IN"))

            return Edge(id=element_id, label=label, source=source, target=target, properties=properties)
        except Exception as e:
            raise SerializationError(f"Failed to deserialize edge: {e}") from e

    def deserialize_path(self, raw: Any) -> Path:
        """Convert a Gremlin path result to a Path."""
        try:
            objects = raw.objects if hasattr(raw, "objects") else list(raw)
            vertices: list[Vertex] = []
            edges: list[Edge] = []
            for obj in objects:
                # Path objects alternate between vertices and edges
                if self._is_vertex_map(obj):
                    vertices.append(self.deserialize_vertex(obj))
                elif self._is_edge_map(obj):
                    edges.append(self.deserialize_edge(obj))
                else:
                    # Raw vertex/edge object (not elementMap)
                    eid = self._extract_id(obj)
                    if hasattr(obj, "label"):
                        label = obj.label
                    else:
                        label = str(self._extract_label(obj)) if isinstance(obj, dict) else ""
                    vertices.append(Vertex(id=str(eid), label=label, properties={}))
            return Path(vertices=vertices, edges=edges)
        except Exception as e:
            raise SerializationError(f"Failed to deserialize path: {e}") from e

    def deserialize_graph_response(self, raw: Any) -> GraphResponse:
        """Convert a list of projected edge results to a GraphResponse."""
        nodes: list[Vertex] = []
        edges: list[Edge] = []

        if not raw:
            return GraphResponse(nodes=nodes, edges=edges, records=[])

        seen_node_ids: set[str] = set()

        for record in raw:
            if isinstance(record, dict):
                # New project-based format: eid, elabel, eprops, source, target
                if "eid" in record:
                    edge = self.deserialize_edge(record)
                    edges.append(edge)

                    source_map = record.get("source")
                    target_map = record.get("target")
                else:
                    # Legacy format: edge, source, target
                    edge_map = record.get("edge")
                    source_map = record.get("source")
                    target_map = record.get("target")

                    if edge_map:
                        edge = self.deserialize_edge(edge_map, source_map, target_map)
                        edges.append(edge)

                if source_map:
                    source_vertex = self.deserialize_vertex(source_map)
                    if source_vertex.id not in seen_node_ids:
                        nodes.append(source_vertex)
                        seen_node_ids.add(source_vertex.id)

                if target_map:
                    target_vertex = self.deserialize_vertex(target_map)
                    if target_vertex.id not in seen_node_ids:
                        nodes.append(target_vertex)
                        seen_node_ids.add(target_vertex.id)

        metadata = ResultMetadata(
            node_count=len(nodes),
            edge_count=len(edges),
            record_count=len(raw),
        )
        return GraphResponse(nodes=nodes, edges=edges, records=[], metadata=metadata)

    # -- Extraction helpers --

    def _extract_id(self, raw: Any) -> Any:
        """Extract the element ID from a Gremlin result."""
        if isinstance(raw, dict):
            # elementMap() puts T.id as a key
            if T.id in raw:
                return raw[T.id]
            # Some serializers use string keys
            if "id" in raw:
                return raw["id"]
            if T.id in raw:
                return raw[T.id]
        if hasattr(raw, "id"):
            return raw.id
        raise SerializationError(f"Cannot extract ID from {type(raw)}")

    def _extract_label(self, raw: Any) -> str:
        """Extract the label from a Gremlin result."""
        if isinstance(raw, dict):
            if T.label in raw:
                return raw[T.label]
            if "label" in raw:
                return raw["label"]
        if hasattr(raw, "label"):
            return raw.label
        return ""

    def _extract_properties(self, raw: Any) -> dict[str, Any]:
        """Extract properties, stripping T.id, T.label, and Direction keys."""
        if not isinstance(raw, dict):
            return {}
        skip_keys = {T.id, T.label, "id", "label"}
        props = {}
        for key, value in raw.items():
            if key in skip_keys:
                continue
            # Skip Direction enum keys (IN/OUT endpoint references in edge elementMap)
            key_str = str(key)
            if key_str in ("Direction.IN", "Direction.OUT"):
                continue
            # gremlinpython uses enum members as keys for directions
            if hasattr(key, "name") and key.name in ("IN", "OUT"):
                continue
            props[key if isinstance(key, str) else str(key)] = value
        return props

    def _extract_edge_endpoint(self, raw: dict, direction: str) -> Any:
        """Extract the source or target vertex ID from an edge elementMap."""

        # elementMap() stores endpoints as {Direction.IN: {T.id: ..., T.label: ...}}
        for key, value in raw.items():
            key_str = str(key)
            if direction == "OUT" and ("OUT" in key_str):
                if isinstance(value, dict) and T.id in value:
                    return value[T.id]
                if isinstance(value, dict) and "id" in value:
                    return value["id"]
            if direction == "IN" and ("IN" in key_str):
                if isinstance(value, dict) and T.id in value:
                    return value[T.id]
                if isinstance(value, dict) and "id" in value:
                    return value["id"]

        raise SerializationError(f"Cannot extract {direction} endpoint from edge")

    def _is_vertex_map(self, obj: Any) -> bool:
        """Check if a dict looks like a vertex elementMap (has T.id but no Direction keys)."""
        if not isinstance(obj, dict):
            return False
        if T.id not in obj and "id" not in obj:
            return False
        # Edges have direction keys, vertices don't
        for key in obj:
            key_str = str(key)
            if "Direction" in key_str or (hasattr(key, "name") and key.name in ("IN", "OUT")):
                return False
        return True

    def _is_edge_map(self, obj: Any) -> bool:
        """Check if a dict looks like an edge elementMap (has direction endpoint keys)."""
        if not isinstance(obj, dict):
            return False
        for key in obj:
            key_str = str(key)
            if "Direction" in key_str or (hasattr(key, "name") and key.name in ("IN", "OUT")):
                return True
        return False
