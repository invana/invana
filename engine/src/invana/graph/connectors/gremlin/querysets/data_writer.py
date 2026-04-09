"""Gremlin data-writing queryset implementation."""

from invana.graph.connectors.base.querysets.data_writer import BaseDataWriterQuerySet
from invana.graph.connectors.gremlin.query_builder import GremlinQueryBuilder
from invana.graph.types.data_elements import Edge, Vertex


class GremlinDataWriterQuerySet(BaseDataWriterQuerySet):
    """Gremlin implementation of data-writing operations."""

    async def create_vertex(self, label: str, properties: dict) -> Vertex:
        """Create a new vertex with the given label and properties."""
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.create_vertex(g, label, properties)
        result = await self._connector.execute_traversal(traversal)
        return self._serializer.deserialize_vertex(result[0])

    async def create_edge(
        self,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> Edge:
        """Create an edge between two existing vertices."""
        g = await self._connector.get_traversal_source()
        sid = self._connector.coerce_id(source_id)
        tid = self._connector.coerce_id(target_id)
        traversal = GremlinQueryBuilder.create_edge(g, label, sid, tid, properties)
        result = await self._connector.execute_traversal(traversal)
        return self._serializer.deserialize_edge(result[0])

    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex:
        """Merge-update vertex properties."""
        g = await self._connector.get_traversal_source()
        vid = self._connector.coerce_id(vertex_id)
        traversal = GremlinQueryBuilder.update_vertex(g, vid, properties)
        result = await self._connector.execute_traversal(traversal)
        return self._serializer.deserialize_vertex(result[0])

    async def update_edge(self, edge_id: str, properties: dict) -> Edge:
        """Merge-update edge properties."""
        g = await self._connector.get_traversal_source()
        eid = self._connector.coerce_id(edge_id)
        traversal = GremlinQueryBuilder.update_edge(g, eid, properties)
        result = await self._connector.execute_traversal(traversal)
        return self._serializer.deserialize_edge(result[0])

    async def delete_vertex(self, vertex_id: str) -> None:
        """Delete a vertex and all its connected edges."""
        g = await self._connector.get_traversal_source()
        vid = self._connector.coerce_id(vertex_id)
        traversal = GremlinQueryBuilder.delete_vertex(g, vid)
        await self._connector.execute_traversal(traversal)

    async def delete_edge(self, edge_id: str) -> None:
        """Delete a single edge."""
        g = await self._connector.get_traversal_source()
        eid = self._connector.coerce_id(edge_id)
        traversal = GremlinQueryBuilder.delete_edge(g, eid)
        await self._connector.execute_traversal(traversal)
