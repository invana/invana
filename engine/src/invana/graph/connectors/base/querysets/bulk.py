"""Abstract bulk operations queryset."""

from abc import ABC, abstractmethod

from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.data_elements import Edge, Vertex


class BaseBulkQuerySet(BaseQuerySet, ABC):
    """Abstract interface for batch create/delete operations."""

    @abstractmethod
    async def bulk_create_vertices(self, label: str, records: list[dict]) -> list[Vertex]:
        """Create multiple vertices in a single query."""

    @abstractmethod
    async def bulk_create_edges(self, label: str, records: list[dict]) -> list[Edge]:
        """Create multiple edges in a single query.

        Each record must contain ``source_id``, ``target_id``, and ``properties`` keys.
        """

    @abstractmethod
    async def bulk_delete_vertices(self, vertex_ids: list[str]) -> int:
        """Delete multiple vertices by ID. Returns the count of deleted vertices."""

    @abstractmethod
    async def bulk_delete_edges(self, edge_ids: list[str]) -> int:
        """Delete multiple edges by ID. Returns the count of deleted edges."""
