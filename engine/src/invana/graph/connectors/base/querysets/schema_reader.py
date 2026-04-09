"""Abstract schema-reading queryset."""

from abc import ABC, abstractmethod

from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.schema_elements import (
    ConstraintInfo,
    EdgeSchemaInfo,
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
