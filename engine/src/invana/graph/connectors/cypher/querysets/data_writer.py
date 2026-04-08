"""OpenCypher data-writing queryset implementation."""

from invana.graph.connectors.base.data_types.data_elements import Edge, Vertex
from invana.graph.connectors.base.querysets.data_writer import BaseDataWriterQuerySet
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder


class OpenCypherDataWriterQuerySet(BaseDataWriterQuerySet):
    """OpenCypher implementation of data-writing operations."""

    async def create_vertex(self, label: str, properties: dict) -> Vertex:
        query, params = OpenCypherQueryBuilder.create_node(label, properties)
        raw = await self._connector.execute(query, params)
        return self._serializer.deserialize_vertex(raw[0]["n"])

    async def create_edge(
        self,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> Edge:
        query, params = OpenCypherQueryBuilder.create_edge(label, source_id, target_id, properties)
        raw = await self._connector.execute(query, params)
        return self._serializer.deserialize_edge(raw[0]["r"], raw[0]["a"], raw[0]["b"])

    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex:
        query, params = OpenCypherQueryBuilder.update_node(vertex_id, properties)
        raw = await self._connector.execute(query, params)
        return self._serializer.deserialize_vertex(raw[0]["n"])

    async def update_edge(self, edge_id: str, properties: dict) -> Edge:
        query, params = OpenCypherQueryBuilder.update_edge(edge_id, properties)
        raw = await self._connector.execute(query, params)
        # update_edge query only returns r, not a and b
        return self._serializer.deserialize_edge(raw[0]["r"])

    async def delete_vertex(self, vertex_id: str) -> None:
        query, params = OpenCypherQueryBuilder.delete_node(vertex_id)
        await self._connector.execute(query, params)

    async def delete_edge(self, edge_id: str) -> None:
        query, params = OpenCypherQueryBuilder.delete_edge(edge_id)
        await self._connector.execute(query, params)
