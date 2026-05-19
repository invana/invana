from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, IndexInfo
from invana.graph.connectors.cypher.querysets.schema_reader import OpenCypherSchemaReaderQuerySet


class Neo4jSchemaReaderQuerySet(OpenCypherSchemaReaderQuerySet):
    """Neo4j-specific schema reader using SHOW INDEXES / SHOW CONSTRAINTS (Neo4j 4.x+)."""

    _TYPE_MAP = {
        "RANGE": "btree",
        "BTREE": "btree",
        "TEXT": "btree",
        "POINT": "btree",
        "FULLTEXT": "fulltext",
        "VECTOR": "vector",
    }

    _CONSTRAINT_TYPE_MAP = {
        "UNIQUENESS": "unique",
        "NODE_PROPERTY_EXISTENCE": "exists",
        "NODE_KEY": "node_key",
        "RELATIONSHIP_UNIQUENESS": "unique",
        "RELATIONSHIP_PROPERTY_EXISTENCE": "exists",
    }

    async def get_indexes(self) -> list[IndexInfo]:
        response = await self._connector.execute(
            "SHOW INDEXES YIELD name, labelsOrTypes, properties, type "
            "WHERE type <> 'LOOKUP' "
            "RETURN name, labelsOrTypes, properties, type"
        )
        result = []
        for record in response.records:
            labels = record["labelsOrTypes"]
            result.append(
                IndexInfo(
                    name=record["name"],
                    label=labels[0] if labels else "",
                    properties=list(record["properties"]),
                    type=self._TYPE_MAP.get(record["type"], "btree"),
                )
            )
        return result

    async def get_constraints(self) -> list[ConstraintInfo]:
        response = await self._connector.execute(
            "SHOW CONSTRAINTS YIELD name, labelsOrTypes, properties, type RETURN name, labelsOrTypes, properties, type"
        )
        result = []
        for record in response.records:
            labels = record["labelsOrTypes"]
            result.append(
                ConstraintInfo(
                    name=record["name"],
                    label=labels[0] if labels else "",
                    properties=list(record["properties"]),
                    type=self._CONSTRAINT_TYPE_MAP.get(record["type"], "unique"),
                )
            )
        return result
