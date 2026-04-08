"""Gremlin schema-writing queryset implementation."""

from typing import Literal

from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet


class GremlinSchemaWriterQuerySet(BaseSchemaWriterQuerySet):
    """Gremlin implementation of schema-writing operations.

    Schema management (indexes, constraints) is not part of the Gremlin spec.
    Vendor-specific connectors should override these methods.
    """

    @not_supported_by_vendor("Gremlin does not have a standard index creation API.")
    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["btree", "fulltext", "composite"] = "btree",
        name: str | None = None,
    ) -> None: ...

    @not_supported_by_vendor("Gremlin does not have a standard drop index API.")
    async def drop_index(self, name: str) -> None: ...

    @not_supported_by_vendor("Gremlin does not have a standard constraint creation API.")
    async def create_constraint(
        self,
        label: str,
        properties: list[str],
        *,
        constraint_type: Literal["unique", "exists", "node_key"] = "unique",
        name: str | None = None,
    ) -> None: ...

    @not_supported_by_vendor("Gremlin does not have a standard drop constraint API.")
    async def drop_constraint(self, name: str) -> None: ...
