"""Gremlin data-reading queryset implementation."""

from typing import Literal

from invana.graph.connectors.base.data_types.data_elements import Edge, GraphResponse, Path, Vertex
from invana.graph.connectors.base.data_types.filters import FilterGroup
from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet
from invana.graph.connectors.gremlin.query_builder import GremlinQueryBuilder


class GremlinDataReaderQuerySet(BaseDataReaderQuerySet):
    """Gremlin implementation of data-reading operations."""

    async def read_vertices(
        self,
        label: str,
        *,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Vertex]:
        """Retrieve vertices by label with optional filtering and pagination."""
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.match_vertices(g, label, filters, limit, offset)
        result = await self._connector.execute_traversal(traversal)
        return [self._serializer.deserialize_vertex(record) for record in result]

    async def read_edges(
        self,
        label: str,
        *,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> list[Edge]:
        """Retrieve edges by relationship type."""
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.match_edges(g, label, source_label, target_label, filters, limit)
        result = await self._connector.execute_traversal(traversal)
        return [self._serializer.deserialize_edge(record) for record in result]

    async def read_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        limit: int | None = None,
    ) -> GraphResponse:
        """Retrieve the neighborhood of a vertex."""
        g = await self._connector.get_traversal_source()
        vid = self._connector.coerce_id(vertex_id)
        traversal = GremlinQueryBuilder.match_neighbors(g, vid, direction, edge_label, limit)
        result = await self._connector.execute_traversal(traversal)
        return self._serializer.deserialize_graph_response(result)

    async def read_vertex_by_id(self, vertex_id: str) -> Vertex:
        """Retrieve a single vertex by its element ID."""
        g = await self._connector.get_traversal_source()
        vid = self._connector.coerce_id(vertex_id)
        traversal = GremlinQueryBuilder.match_vertex_by_id(g, vid)
        result = await self._connector.execute_traversal(traversal)
        return self._serializer.deserialize_vertex(result[0])

    async def read_edge_by_id(self, edge_id: str) -> Edge:
        """Retrieve a single edge by its element ID."""
        g = await self._connector.get_traversal_source()
        eid = self._connector.coerce_id(edge_id)
        traversal = GremlinQueryBuilder.match_edge_by_id(g, eid)
        result = await self._connector.execute_traversal(traversal)
        record = result[0]
        return self._serializer.deserialize_edge(record)

    async def shortest_path(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 10,
    ) -> Path | None:
        """Find the shortest path between two vertices."""
        g = await self._connector.get_traversal_source()
        sid = self._connector.coerce_id(source_id)
        tid = self._connector.coerce_id(target_id)
        traversal = GremlinQueryBuilder.shortest_path(g, sid, tid, max_depth)
        result = await self._connector.execute_traversal(traversal)
        if not result:
            return None
        return self._serializer.deserialize_path(result[0])

    async def count_vertices(self, label: str | None = None) -> int:
        """Count vertices, optionally filtered by label."""
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.count_vertices(g, label)
        result = await self._connector.execute_traversal(traversal)
        return result[0]

    async def count_edges(self, label: str | None = None) -> int:
        """Count edges, optionally filtered by relationship type."""
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.count_edges(g, label)
        result = await self._connector.execute_traversal(traversal)
        return result[0]
