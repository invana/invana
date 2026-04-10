"""OpenCypher schema-writing queryset."""

from typing import Any, Literal

from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet


class OpenCypherSchemaWriterQuerySet(BaseSchemaWriterQuerySet):
    """OpenCypher schema-writing stub.

    Standard openCypher has no universal DDL for indexes or constraints — the
    syntax differs significantly between Neo4j, Memgraph, and ArcadeDB.  All
    methods raise ``NotImplementedError``; each vendor connector must override
    them with database-specific implementations.
    """

    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["range", "btree", "composite"] = "range",
        name: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> None:
        raise NotImplementedError

    async def drop_index(self, name: str) -> None:
        raise NotImplementedError

    async def create_constraint(
        self,
        label: str,
        properties: list[str],
        *,
        constraint_type: Literal["unique"] = "unique",
        name: str | None = None,
    ) -> None:
        raise NotImplementedError

    async def drop_constraint(self, name: str) -> None:
        raise NotImplementedError
