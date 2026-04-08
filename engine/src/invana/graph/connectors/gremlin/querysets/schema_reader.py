"""Gremlin schema-reading queryset implementation."""

from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, IndexInfo
from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.querysets.schema_reader import BaseSchemaReaderQuerySet
from invana.graph.connectors.gremlin.query_builder import GremlinQueryBuilder


class GremlinSchemaReaderQuerySet(BaseSchemaReaderQuerySet):
    """Gremlin implementation of schema-reading operations.

    Basic label/key introspection is supported. Index and constraint
    inspection is not part of the Gremlin spec and must be provided
    by vendor-specific connectors.
    """

    async def get_node_labels(self) -> list[str]:
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.get_node_labels(g)
        return await self._connector.execute_traversal(traversal)

    async def get_edge_labels(self) -> list[str]:
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.get_edge_labels(g)
        return await self._connector.execute_traversal(traversal)

    async def get_property_keys(self, label: str) -> list[str]:
        g = await self._connector.get_traversal_source()
        traversal = GremlinQueryBuilder.get_property_keys(g, label)
        return await self._connector.execute_traversal(traversal)

    @not_supported_by_vendor("Gremlin does not have a standard index introspection API.")
    async def get_indexes(self) -> list[IndexInfo]: ...

    @not_supported_by_vendor("Gremlin does not have a standard constraint introspection API.")
    async def get_constraints(self) -> list[ConstraintInfo]: ...
