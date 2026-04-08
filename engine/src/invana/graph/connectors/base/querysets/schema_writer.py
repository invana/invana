"""Abstract schema-writing queryset."""

from abc import ABC, abstractmethod
from typing import Literal

from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseSchemaWriterQuerySet(BaseQuerySet, ABC):
    """Abstract interface for managing indexes and constraints."""

    @abstractmethod
    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["btree", "fulltext", "composite"] = "btree",
        name: str | None = None,
    ) -> None:
        """Create an index on the given label and properties."""

    @abstractmethod
    async def drop_index(self, name: str) -> None:
        """Drop an index by name."""

    @abstractmethod
    async def create_constraint(
        self,
        label: str,
        properties: list[str],
        *,
        constraint_type: Literal["unique", "exists", "node_key"] = "unique",
        name: str | None = None,
    ) -> None:
        """Create a constraint on the given label and properties."""

    @abstractmethod
    async def drop_constraint(self, name: str) -> None:
        """Drop a constraint by name."""
