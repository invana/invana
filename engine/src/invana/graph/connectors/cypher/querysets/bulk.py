"""OpenCypher bulk operations queryset implementation."""

from invana.graph.connectors.base.data_types.data_elements import Edge, Vertex
from invana.graph.connectors.base.querysets.bulk import BaseBulkQuerySet
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder


class OpenCypherBulkQuerySet(BaseBulkQuerySet):
    """OpenCypher implementation of bulk operations using ``UNWIND``."""

    async def bulk_create_vertices(self, label: str, records: list[dict]) -> list[Vertex]:
        query, params = OpenCypherQueryBuilder.bulk_create_nodes(label, records)
        raw = await self._connector.execute(query, params)
        return [self._serializer.deserialize_vertex(record["n"]) for record in raw]

    async def bulk_create_edges(self, label: str, records: list[dict]) -> list[Edge]:
        query, params = OpenCypherQueryBuilder.bulk_create_edges(label, records)
        raw = await self._connector.execute(query, params)
        return [self._serializer.deserialize_edge(record["r"], record["a"], record["b"]) for record in raw]

    async def bulk_delete_vertices(self, vertex_ids: list[str]) -> int:
        query, params = OpenCypherQueryBuilder.bulk_delete_nodes(vertex_ids)
        await self._connector.execute(query, params)
        return len(vertex_ids)

    async def bulk_delete_edges(self, edge_ids: list[str]) -> int:
        query, params = OpenCypherQueryBuilder.bulk_delete_edges(edge_ids)
        await self._connector.execute(query, params)
        return len(edge_ids)
