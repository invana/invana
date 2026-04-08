from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, IndexInfo
from invana.graph.connectors.base.querysets.schema_reader import BaseSchemaReaderQuerySet
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder


class OpenCypherSchemaReaderQuerySet(BaseSchemaReaderQuerySet):
    async def get_node_labels(self) -> list[str]:
        query, params = OpenCypherQueryBuilder.get_node_labels()
        raw = await self._connector.execute(query, params)
        return [record["label"] for record in raw]

    async def get_edge_labels(self) -> list[str]:
        query, params = OpenCypherQueryBuilder.get_edge_labels()
        raw = await self._connector.execute(query, params)
        return [record["relationshipType"] for record in raw]

    async def get_property_keys(self, label: str) -> list[str]:
        query, params = OpenCypherQueryBuilder.get_property_keys(label)
        raw = await self._connector.execute(query, params)
        return [record["key"] for record in raw]

    async def get_indexes(self) -> list[IndexInfo]:
        # Standard openCypher doesn't have a universal SHOW INDEXES command.
        # This is a no-op base; Neo4j/Memgraph override with vendor-specific queries.
        return []

    async def get_constraints(self) -> list[ConstraintInfo]:
        # Standard openCypher doesn't have a universal SHOW CONSTRAINTS command.
        # This is a no-op base; Neo4j/Memgraph override with vendor-specific queries.
        return []
