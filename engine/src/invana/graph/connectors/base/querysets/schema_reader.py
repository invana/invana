"""Abstract schema-reading queryset."""

from abc import ABC, abstractmethod

from invana.graph.connectors.base.data_types.schema_elements import ConstraintInfo, IndexInfo
from invana.graph.connectors.base.querysets.base import BaseQuerySet


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
