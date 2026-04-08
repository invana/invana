"""Gremlin bulk operations queryset implementation."""

from invana.graph.connectors.base.data_types.data_elements import Edge, Vertex
from invana.graph.connectors.base.querysets.bulk import BaseBulkQuerySet
from invana.graph.connectors.gremlin.query_builder import GremlinQueryBuilder


class GremlinBulkQuerySet(BaseBulkQuerySet):
    """Gremlin implementation of bulk operations."""

    async def bulk_create_vertices(self, label: str, records: list[dict]) -> list[Vertex]:
        """Create multiple vertices in a batch."""
        if not records:
            return []
        g = await self._connector.get_traversal_source()
        vertices = []
        for props in records:
            traversal = GremlinQueryBuilder.create_vertex(g, label, props)
            result = await self._connector.execute_traversal(traversal)
            vertices.append(self._serializer.deserialize_vertex(result[0]))
        return vertices

    async def bulk_create_edges(self, label: str, records: list[dict]) -> list[Edge]:
        """Create multiple edges in a batch."""
        if not records:
            return []
        g = await self._connector.get_traversal_source()
        edges = []
        for rec in records:
            sid = self._connector.coerce_id(rec["source_id"])
            tid = self._connector.coerce_id(rec["target_id"])
            props = rec.get("properties", {})
            traversal = GremlinQueryBuilder.create_edge(g, label, sid, tid, props or None)
            result = await self._connector.execute_traversal(traversal)
            edges.append(self._serializer.deserialize_edge(result[0]))
        return edges

    async def bulk_delete_vertices(self, vertex_ids: list[str]) -> int:
        """Delete multiple vertices by ID."""
        if not vertex_ids:
            return 0
        g = await self._connector.get_traversal_source()
        coerced_ids = [self._connector.coerce_id(vid) for vid in vertex_ids]
        # Drop all vertices in a single traversal
        traversal = g.V(*coerced_ids).drop()
        await self._connector.execute_traversal(traversal)
        return len(vertex_ids)

    async def bulk_delete_edges(self, edge_ids: list[str]) -> int:
        """Delete multiple edges by ID."""
        if not edge_ids:
            return 0
        g = await self._connector.get_traversal_source()
        coerced_ids = [self._connector.coerce_id(eid) for eid in edge_ids]
        traversal = g.E(*coerced_ids).drop()
        await self._connector.execute_traversal(traversal)
        return len(edge_ids)
