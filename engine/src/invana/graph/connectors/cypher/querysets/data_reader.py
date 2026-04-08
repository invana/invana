"""OpenCypher data-reading queryset implementation."""

from typing import Literal

from invana.graph.connectors.base.data_types.data_elements import Edge, GraphResponse, Path, Vertex
from invana.graph.connectors.base.data_types.filters import FilterGroup
from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder


class OpenCypherDataReaderQuerySet(BaseDataReaderQuerySet):
    """OpenCypher implementation of data-reading operations."""

    async def read_vertices(
        self,
        label: str,
        *,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Vertex]:
        query, params = OpenCypherQueryBuilder.match_nodes(label, filters, limit, offset)
        raw = await self._connector.execute(query, params)
        return [self._serializer.deserialize_vertex(record["n"]) for record in raw]

    async def read_edges(
        self,
        label: str,
        *,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> list[Edge]:
        query, params = OpenCypherQueryBuilder.match_edges(label, source_label, target_label, filters, limit)
        raw = await self._connector.execute(query, params)
        return [self._serializer.deserialize_edge(record["r"], record["a"], record["b"]) for record in raw]

    async def read_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        limit: int | None = None,
    ) -> GraphResponse:
        query, params = OpenCypherQueryBuilder.match_neighbors(vertex_id, direction, edge_label, limit)
        raw = await self._connector.execute(query, params)
        return self._serializer.deserialize_graph_response(raw)

    async def read_vertex_by_id(self, vertex_id: str) -> Vertex:
        query, params = OpenCypherQueryBuilder.match_node_by_id(vertex_id)
        raw = await self._connector.execute(query, params)
        return self._serializer.deserialize_vertex(raw[0]["n"])

    async def read_edge_by_id(self, edge_id: str) -> Edge:
        query, params = OpenCypherQueryBuilder.match_edge_by_id(edge_id)
        raw = await self._connector.execute(query, params)
        return self._serializer.deserialize_edge(raw[0]["r"], raw[0]["a"], raw[0]["b"])

    async def shortest_path(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 10,
    ) -> Path | None:
        query, params = OpenCypherQueryBuilder.shortest_path(source_id, target_id, max_depth)
        raw = await self._connector.execute(query, params)
        if not raw:
            return None
        return self._serializer.deserialize_path(raw[0]["p"])

    async def count_vertices(self, label: str | None = None) -> int:
        query, params = OpenCypherQueryBuilder.count_nodes(label)
        raw = await self._connector.execute(query, params)
        return raw[0]["cnt"]

    async def count_edges(self, label: str | None = None) -> int:
        query, params = OpenCypherQueryBuilder.count_edges(label)
        raw = await self._connector.execute(query, params)
        return raw[0]["cnt"]
