"""OpenCypher data-writing queryset implementation."""

from invana.graph.connectors.base.querysets.data_writer import BaseDataWriterQuerySet
from invana.graph.types.data_elements import Edge, Vertex


class OpenCypherDataWriterQuerySet(BaseDataWriterQuerySet):
    """OpenCypher implementation of data-writing operations."""

    async def create_vertex(self, label: str, properties: dict) -> Vertex:
        query, params = self._connector.query_builder.create_node(label, properties)
        response = await self._connector.execute(query, params)
        return response.nodes[0]

    async def create_edge(
        self,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> Edge:
        query, params = self._connector.query_builder.create_edge(
            label, self._connector.coerce_id(source_id), self._connector.coerce_id(target_id), properties
        )
        response = await self._connector.execute(query, params)
        return response.edges[0]

    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex:
        query, params = self._connector.query_builder.update_node(self._connector.coerce_id(vertex_id), properties)
        response = await self._connector.execute(query, params)
        return response.nodes[0]

    async def update_edge(self, edge_id: str, properties: dict) -> Edge:
        query, params = self._connector.query_builder.update_edge(self._connector.coerce_id(edge_id), properties)
        response = await self._connector.execute(query, params)
        return response.edges[0]

    async def delete_vertex(self, vertex_id: str) -> None:
        query, params = self._connector.query_builder.delete_node(self._connector.coerce_id(vertex_id))
        await self._connector.execute(query, params)

    async def delete_edge(self, edge_id: str) -> None:
        query, params = self._connector.query_builder.delete_edge(self._connector.coerce_id(edge_id))
        await self._connector.execute(query, params)
