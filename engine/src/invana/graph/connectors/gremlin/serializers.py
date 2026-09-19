"""Gremlin serializer — converts Gremlin traversal results to Pydantic models.

This serializer handles the elementMap() format returned by the Gremlin
Python driver. Integration packages can subclass if their driver returns
a different raw format.
"""

from __future__ import annotations

from typing import Any

from gremlin_python.process.traversal import T
from gremlin_python.structure.graph import Edge as GremlinEdge
from gremlin_python.structure.graph import Path as GremlinPath
from gremlin_python.structure.graph import Vertex as GremlinVertex

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
                element_id = str(self.coerce_element_id(raw["eid"]))
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
        """Convert Gremlin results to a GraphResponse.

        Two kinds of result arrive here. The **querysets** send the projected
        shapes they built themselves (``eid``/``source``/``target``). A **script**
        sends whatever the person or the model asked for — reference vertices,
        edges, paths, maps, counts, strings.

        Anything that is not a vertex or an edge becomes a **record**
        (docs/for-developers/modules/graph-connectors/features/languages.md LG8).
        Dropping what this serializer did not recognise reported an empty answer
        for a query that returned rows, and an empty answer is the one wrong
        answer that reads like a right one.
        """
        nodes: list[Vertex] = []
        edges: list[Edge] = []
        records: list[dict[str, Any]] = []

        if not raw:
            return GraphResponse(nodes=nodes, edges=edges, records=records)

        seen_node_ids: set[str] = set()

        def _keep_node(vertex: Vertex) -> None:
            if vertex.id not in seen_node_ids:
                nodes.append(vertex)
                seen_node_ids.add(vertex.id)

        for record in raw:
            if isinstance(record, dict) and ("eid" in record or "edge" in record):
                if "eid" in record:
                    edges.append(self.deserialize_edge(record))
                    source_map = record.get("source")
                    target_map = record.get("target")
                else:
                    edge_map = record.get("edge")
                    source_map = record.get("source")
                    target_map = record.get("target")
                    if edge_map:
                        edges.append(self.deserialize_edge(edge_map, source_map, target_map))
                if source_map:
                    _keep_node(self.deserialize_vertex(source_map))
                if target_map:
                    _keep_node(self.deserialize_vertex(target_map))
                continue

            if isinstance(record, GremlinPath):
                path = self.deserialize_path(record)
                for vertex in path.vertices:
                    _keep_node(vertex)
                edges.extend(path.edges)
                continue

            if isinstance(record, GremlinEdge):
                edges.append(
                    Edge(
                        id=str(self.coerce_element_id(record.id)),
                        label=record.label,
                        source=str(self.coerce_element_id(record.outV.id)) if record.outV else "",
                        target=str(self.coerce_element_id(record.inV.id)) if record.inV else "",
                        properties={},
                    )
                )
                continue

            if isinstance(record, GremlinVertex) or self._is_edge_map(record) or self._is_vertex_map(record):
                if isinstance(record, GremlinVertex) or self._is_vertex_map(record):
                    _keep_node(self.deserialize_vertex(record))
                else:
                    edges.append(self.deserialize_edge(record))
                continue

            records.append(self._as_record(record))

        metadata = ResultMetadata(
            node_count=len(nodes),
            edge_count=len(edges),
            record_count=len(raw),
        )
        return GraphResponse(nodes=nodes, edges=edges, records=records, metadata=metadata)

    def _as_record(self, value: Any) -> dict[str, Any]:
        """A script result that is not an element, as a row.

        A map — ``valueMap()``, ``project()``, ``group()`` — is already a row and
        keeps its own keys, stringified because Gremlin keys can be enum members.
        Anything else is a single value, and the column is called ``value``: the
        Gremlin protocol returns a flat list, so unlike Cypher there is no column
        name to carry through.
        """
        if isinstance(value, dict):
            return {str(k): v for k, v in value.items()}
        return {"value": value}

    # -- Extraction helpers --

    def coerce_element_id(self, value: Any) -> Any:
        """The single funnel every element id passes through on the way out.

        Identity here. A vendor whose id is its own type — JanusGraph's
        ``RelationIdentifier`` — overrides this one method instead of every place
        an id is read, so a shape that arrives by one path cannot be unwrapped
        while the same shape arriving by another is not.
        """
        return value

    def _extract_id(self, raw: Any) -> Any:
        """Extract the element ID from a Gremlin result."""
        if isinstance(raw, dict):
            # elementMap() puts T.id as a key
            if T.id in raw:
                return self.coerce_element_id(raw[T.id])
            # Some serializers use string keys
            if "id" in raw:
                return self.coerce_element_id(raw["id"])
        if hasattr(raw, "id"):
            return self.coerce_element_id(raw.id)
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
            if (direction == "OUT" and "OUT" in key_str) or (direction == "IN" and "IN" in key_str):
                if isinstance(value, dict) and T.id in value:
                    return self.coerce_element_id(value[T.id])
                if isinstance(value, dict) and "id" in value:
                    return self.coerce_element_id(value["id"])

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
