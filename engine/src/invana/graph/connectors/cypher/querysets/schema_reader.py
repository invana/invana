"""OpenCypher schema-reading queryset implementation."""

from typing import Any

from invana.graph.connectors.base.querysets.schema_reader import BaseSchemaReaderQuerySet
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder
from invana.graph.types.schema_elements import (
    ConstraintInfo,
    EdgeSchemaInfo,
    IndexInfo,
    PropertyInfo,
)


def _infer_type(values: list[Any]) -> str:
    """Infer a property type from a list of sample values."""
    non_null = [v for v in values if v is not None]
    if not non_null:
        return "string"
    types = {type(v).__name__ for v in non_null}
    if types == {"int"}:
        return "integer"
    if types == {"float"}:
        return "float"
    if types <= {"int", "float"}:
        return "float"
    if types == {"bool"}:
        return "boolean"
    if types == {"list"}:
        return "list"
    return "string"


class OpenCypherSchemaReaderQuerySet(BaseSchemaReaderQuerySet):
    """OpenCypher implementation of schema-reading operations.

    ``get_indexes()`` and ``get_constraints()`` return empty lists because
    standard openCypher has no universal introspection commands. Vendor
    connectors override these with database-specific queries.
    """

    async def get_node_labels(self) -> list[str]:
        query, params = OpenCypherQueryBuilder.get_node_labels()
        response = await self._connector.execute(query, params)
        return [record["label"] for record in response.records]

    async def get_edge_labels(self) -> list[str]:
        query, params = OpenCypherQueryBuilder.get_edge_labels()
        response = await self._connector.execute(query, params)
        return [record["relationshipType"] for record in response.records]

    async def get_property_keys(self, label: str) -> list[str]:
        query, params = OpenCypherQueryBuilder.get_property_keys(label)
        response = await self._connector.execute(query, params)
        return [record["key"] for record in response.records]

    async def get_indexes(self) -> list[IndexInfo]:
        # Standard openCypher doesn't have a universal SHOW INDEXES command.
        # This is a no-op base; Neo4j/Memgraph override with vendor-specific queries.
        return []

    async def get_constraints(self) -> list[ConstraintInfo]:
        # Standard openCypher doesn't have a universal SHOW CONSTRAINTS command.
        # This is a no-op base; Neo4j/Memgraph override with vendor-specific queries.
        return []

    async def get_property_schema(
        self,
        label: str,
        *,
        sample_size: int = 100,
    ) -> list[PropertyInfo]:
        query = (
            f"MATCH (n:`{label}`) WITH n LIMIT $sample_size "
            "UNWIND keys(n) AS key "
            "WITH key, collect(n[key])[..5] AS samples, count(*) AS cnt "
            "RETURN key, samples, cnt"
        )
        response = await self._connector.execute(query, {"sample_size": sample_size})
        results: list[PropertyInfo] = []
        for record in response.records:
            samples = record.get("samples", [])
            results.append(
                PropertyInfo(
                    name=record["key"],
                    inferred_type=_infer_type(samples),
                    sample_values=samples,
                    null_count=0,
                    total_count=record.get("cnt", 0),
                )
            )
        return results

    async def get_edge_schema(
        self,
        label: str,
        *,
        sample_size: int = 100,
    ) -> EdgeSchemaInfo:
        query = (
            f"MATCH (s)-[r:`{label}`]->(t) "
            f"WITH labels(s) AS src, labels(t) AS tgt, keys(r) AS ks LIMIT $sample_size "
            "RETURN collect(DISTINCT src[0]) AS source_labels, "
            "collect(DISTINCT tgt[0]) AS target_labels, "
            "reduce(acc = [], k IN collect(ks) | acc + k) AS all_keys"
        )
        response = await self._connector.execute(query, {"sample_size": sample_size})
        if response.records:
            record = response.records[0]
            all_keys = list(dict.fromkeys(record.get("all_keys", [])))
            return EdgeSchemaInfo(
                name=label,
                source_labels=record.get("source_labels", []),
                target_labels=record.get("target_labels", []),
                property_keys=all_keys,
            )
        return EdgeSchemaInfo(name=label, source_labels=[], target_labels=[])
