"""Abstract schema-reading queryset."""

from __future__ import annotations

from abc import ABC, abstractmethod

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.connectors.base.lens import admit_structured
from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.lens import QueryLens
from invana.graph.types.schema_elements import (
    ConstraintInfo,
    EdgeSchemaInfo,
    GraphSchemaSnapshot,
    IndexInfo,
    PropertyInfo,
)


class BaseSchemaReaderQuerySet(BaseQuerySet, ABC):
    """Abstract interface for inspecting database schema."""

    @abstractmethod
    async def get_node_labels(self) -> list[str]:
        """Return all node labels in the database."""

    @abstractmethod
    async def get_edge_labels(self) -> list[str]:
        """Return all relationship types in the database."""

    @abstractmethod
    async def get_property_keys(self, label: str) -> list[str]:
        """Return distinct property keys for a given label."""

    @abstractmethod
    async def get_indexes(self) -> list[IndexInfo]:
        """Return all indexes in the database."""

    @abstractmethod
    async def get_constraints(self) -> list[ConstraintInfo]:
        """Return all constraints in the database."""

    @abstractmethod
    async def get_property_schema(
        self,
        label: str,
        *,
        sample_size: int = 100,
    ) -> list[PropertyInfo]:
        """Infer property types from existing data by sampling."""

    @abstractmethod
    async def get_edge_schema(
        self,
        label: str,
        *,
        sample_size: int = 100,
    ) -> EdgeSchemaInfo:
        """Infer edge endpoint patterns and property keys from existing data."""

    async def get_node_label_counts(self) -> dict[str, int] | None:
        """Return ``{label: count}`` for every node label, or ``None``.

        ``None`` means *this vendor cannot count* — the Explorer's type panel
        then lists the types without numbers rather than showing nothing
        (selection-and-the-panel.md SP8). The base returns ``None`` so a
        connector that has not implemented counting degrades instead of raising.
        """
        return None

    async def get_edge_label_counts(self) -> dict[str, int] | None:
        """Return ``{label: count}`` for every edge label, or ``None``.

        See :meth:`get_node_label_counts`.
        """
        return None

    async def count_types(self, lens: QueryLens | None = None) -> tuple[dict[str, int] | None, dict[str, int] | None]:
        """``({node type: count}, {edge type: count})`` inside *lens* (SP11).

        No lens is the vendor's own counts, ``None`` where it cannot count
        (SP8). Under a lens a denied type is never matched and each count is
        taken inside its slice — composed by the language's builder, never a
        filter over the graph-wide numbers. A connector with no governed count
        **refuses**: counting the whole graph for a narrowed world is the one
        answer it may not give.
        """
        governed = admit_structured(lens)
        if governed is None:
            return await self.get_node_label_counts(), await self.get_edge_label_counts()
        return await self._count_types_under(governed)

    async def _count_types_under(self, lens: QueryLens) -> tuple[dict[str, int], dict[str, int]]:
        raise LensViolationError("This connection cannot count types under a world.", code="lens_not_supported")

    async def get_edge_multiplicity(self, label: str) -> str:
        """Return the multiplicity for an edge label.

        Defaults to ``"MULTI"``. Gremlin vendors override to query
        the management API.
        """
        return "MULTI"

    async def get_property_cardinality(self, label: str, key: str) -> str:
        """Return the value cardinality for a property key.

        Defaults to ``"SINGLE"``. Gremlin vendors override to query
        the management API.
        """
        return "SINGLE"

    async def get_full_schema(self, *, sample_size: int = 100) -> GraphSchemaSnapshot:
        """Return a complete snapshot of the graph schema.

        Calls all individual introspection methods and combines the results
        into a single :class:`GraphSchemaSnapshot`.  The vendor-specific
        ``get_indexes()`` and ``get_constraints()`` overrides are used
        automatically.
        """
        node_labels = await self.get_node_labels()
        edge_labels = await self.get_edge_labels()

        node_schemas: dict[str, list[PropertyInfo]] = {}
        for label in node_labels:
            node_schemas[label] = await self.get_property_schema(label, sample_size=sample_size)

        edge_schemas: dict[str, EdgeSchemaInfo] = {}
        for label in edge_labels:
            edge_schemas[label] = await self.get_edge_schema(label, sample_size=sample_size)

        indexes = await self.get_indexes()
        constraints = await self.get_constraints()

        return GraphSchemaSnapshot(
            node_labels=node_labels,
            edge_labels=edge_labels,
            node_schemas=node_schemas,
            edge_schemas=edge_schemas,
            indexes=indexes,
            constraints=constraints,
        )
