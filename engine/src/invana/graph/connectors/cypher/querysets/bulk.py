"""OpenCypher bulk operations queryset implementation."""

from invana.graph.connectors.base.querysets.bulk import BaseBulkQuerySet
from invana.graph.types.data_elements import Edge, Vertex


class OpenCypherBulkQuerySet(BaseBulkQuerySet):
    """OpenCypher implementation of bulk operations using ``UNWIND``."""

    async def bulk_create_vertices(self, label: str, records: list[dict]) -> list[Vertex]:
        query, params = self._connector.query_builder.bulk_create_nodes(label, records)
        response = await self._connector.execute(query, params)
        return response.nodes

    async def bulk_create_edges(self, label: str, records: list[dict]) -> list[Edge]:
        # The endpoints ride inside each record rather than as arguments, so they
        # are coerced here — the same boundary every other id crosses.
        records = [
            {
                **r,
                "source_id": self._connector.coerce_id(r["source_id"]),
                "target_id": self._connector.coerce_id(r["target_id"]),
            }
            for r in records
        ]
        query, params = self._connector.query_builder.bulk_create_edges(label, records)
        response = await self._connector.execute(query, params)
        return response.edges

    async def bulk_delete_vertices(self, vertex_ids: list[str]) -> int:
        query, params = self._connector.query_builder.bulk_delete_nodes(
            [self._connector.coerce_id(v) for v in vertex_ids]
        )
        await self._connector.execute(query, params)
        return len(vertex_ids)

    async def bulk_delete_edges(self, edge_ids: list[str]) -> int:
        query, params = self._connector.query_builder.bulk_delete_edges(
            [self._connector.coerce_id(e) for e in edge_ids]
        )
        await self._connector.execute(query, params)
        return len(edge_ids)
