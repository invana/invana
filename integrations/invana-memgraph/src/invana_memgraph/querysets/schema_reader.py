"""Memgraph's index and constraint listing (the-model-page.md MP26).

Memgraph does not speak ``SHOW INDEXES``; it has ``SHOW INDEX INFO`` and
``SHOW CONSTRAINT INFO``, and names neither — so an index is named here by what
it covers, the same key drift matches on (MP27).
"""

from __future__ import annotations

from invana.graph.connectors.cypher.querysets.schema_reader import OpenCypherSchemaReaderQuerySet
from invana.graph.types.schema_elements import ConstraintInfo, IndexInfo

# `label` is a label scan with nothing to seek on — Neo4j's LOOKUP, left out the same way.
_INDEX_TYPES = {"label+property": "btree", "edge-type+property": "btree", "point": "point", "text": "fulltext"}
_CONSTRAINT_TYPES = {"unique": "unique", "exists": "exists"}


def _properties(value: object) -> list[str]:
    """One property comes back as a string, several as a list, none as null."""
    if value is None:
        return []
    return [str(v) for v in value] if isinstance(value, list | tuple) else [str(value)]


def _name(label: str, properties: list[str], suffix: str) -> str:
    return "_".join([label, *properties, suffix]).lower()


class MemgraphSchemaReaderQuerySet(OpenCypherSchemaReaderQuerySet):
    lists_schema = True

    async def get_indexes(self) -> list[IndexInfo]:
        response = await self._connector.execute("SHOW INDEX INFO")
        result = []
        for record in response.records:
            kind = _INDEX_TYPES.get(record["index type"])
            properties = _properties(record["property"])
            if kind is None or not properties:
                continue
            label = record["label"]
            result.append(
                IndexInfo(name=_name(label, properties, "index"), label=label, properties=properties, type=kind)
            )
        return result

    async def get_constraints(self) -> list[ConstraintInfo]:
        response = await self._connector.execute("SHOW CONSTRAINT INFO")
        result = []
        for record in response.records:
            kind = _CONSTRAINT_TYPES.get(record["constraint type"])
            if kind is None:
                continue
            label = record["label"]
            properties = _properties(record["properties"])
            result.append(
                ConstraintInfo(name=_name(label, properties, kind), label=label, properties=properties, type=kind)
            )
        return result
