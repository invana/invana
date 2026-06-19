"""OpenCypher data-writing queryset implementation."""

from invana.graph.connectors.base.querysets.data_writer import BaseDataWriterQuerySet
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder
from invana.graph.types.data_elements import Edge, Vertex


class OpenCypherDataWriterQuerySet(BaseDataWriterQuerySet):
    """OpenCypher implementation of data-writing operations."""

    async def create_vertex(self, label: str, properties: dict) -> Vertex:
        query, params = OpenCypherQueryBuilder.create_node(label, properties)
        response = await self._connector.execute(query, params)
        return response.nodes[0]

    async def create_edge(
        self,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> Edge:
        query, params = OpenCypherQueryBuilder.create_edge(label, source_id, target_id, properties)
        response = await self._connector.execute(query, params)
        return response.edges[0]

    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex:
        query, params = OpenCypherQueryBuilder.update_node(vertex_id, properties)
        response = await self._connector.execute(query, params)
        return response.nodes[0]

    async def update_edge(self, edge_id: str, properties: dict) -> Edge:
        query, params = OpenCypherQueryBuilder.update_edge(edge_id, properties)
        response = await self._connector.execute(query, params)
        return response.edges[0]

    async def delete_vertex(self, vertex_id: str) -> None:
        query, params = OpenCypherQueryBuilder.delete_node(vertex_id)
        await self._connector.execute(query, params)

    async def delete_edge(self, edge_id: str) -> None:
        query, params = OpenCypherQueryBuilder.delete_edge(edge_id)
        await self._connector.execute(query, params)
