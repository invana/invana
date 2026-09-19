"""OpenCypher data-reading queryset implementation."""

from typing import Literal

from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet
from invana.graph.types.data_elements import Edge, GraphResponse, Path, Vertex
from invana.graph.types.filters import FilterGroup
from invana.graph.types.sort import SortSpec


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
        query, params = self._connector.query_builder.match_nodes(label, filters, limit, offset)
        response = await self._connector.execute(query, params)
        return response.nodes

    async def read_edges(
        self,
        label: str,
        *,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> list[Edge]:
        query, params = self._connector.query_builder.match_edges(label, source_label, target_label, filters, limit)
        response = await self._connector.execute(query, params)
        return response.edges

    async def read_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> GraphResponse:
        query, params = self._connector.query_builder.match_neighbors(
            self._connector.coerce_id(vertex_id),
            direction,
            edge_label=edge_label,
            neighbor_label=neighbor_label,
            filters=filters,
            sort=sort,
            limit=limit,
            offset=offset,
        )
        response = await self._connector.execute(query, params)
        # Surface the generated traversal so callers can log it
        # (docs/for-developers/modules/explore/features/boards.md — the
        # session records a node-expand's query for explainability).
        response.metadata.query = query
        return response

    async def count_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
    ) -> int:
        query, params = self._connector.query_builder.count_neighbors(
            self._connector.coerce_id(vertex_id),
            direction,
            edge_label=edge_label,
            neighbor_label=neighbor_label,
            filters=filters,
        )
        response = await self._connector.execute(query, params)
        return response.records[0]["cnt"]

    async def read_vertex_by_id(self, vertex_id: str) -> Vertex:
        query, params = self._connector.query_builder.match_node_by_id(self._connector.coerce_id(vertex_id))
        response = await self._connector.execute(query, params)
        return response.nodes[0]

    async def read_edge_by_id(self, edge_id: str) -> Edge:
        query, params = self._connector.query_builder.match_edge_by_id(self._connector.coerce_id(edge_id))
        response = await self._connector.execute(query, params)
        return response.edges[0]

    async def shortest_path(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 10,
    ) -> Path | None:
        query, params = self._connector.query_builder.shortest_path(
            self._connector.coerce_id(source_id), self._connector.coerce_id(target_id), max_depth
        )
        response = await self._connector.execute(query, params)
        if not response.records:
            return None
        return Path.model_validate(response.records[0]["p"])

    async def count_vertices(self, label: str | None = None) -> int:
        query, params = self._connector.query_builder.count_nodes(label)
        response = await self._connector.execute(query, params)
        return response.records[0]["cnt"]

    async def count_edges(self, label: str | None = None) -> int:
        query, params = self._connector.query_builder.count_edges(label)
        response = await self._connector.execute(query, params)
        return response.records[0]["cnt"]
