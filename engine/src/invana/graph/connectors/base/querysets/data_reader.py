"""Abstract data-reading queryset."""

from abc import ABC, abstractmethod
from typing import Literal

from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.data_elements import Edge, GraphResponse, Path, Vertex
from invana.graph.types.filters import FilterGroup
from invana.graph.types.sort import SortSpec


class BaseDataReaderQuerySet(BaseQuerySet, ABC):
    """Abstract interface for reading graph data."""

    @abstractmethod
    async def read_vertices(
        self,
        label: str,
        *,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Vertex]:
        """Retrieve vertices by label with optional filtering and pagination."""

    @abstractmethod
    async def read_edges(
        self,
        label: str,
        *,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> list[Edge]:
        """Retrieve edges by relationship type."""

    @abstractmethod
    async def read_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> GraphResponse:
        """Retrieve the neighborhood of a vertex.

        This is the general traversal primitive; ``edge_label`` constrains the
        relationship type, ``neighbor_label`` constrains the neighbour's label,
        and ``filters`` / ``sort`` / ``limit`` / ``offset`` apply to the neighbour.
        The ``*_by_*`` convenience wrappers below delegate here.
        """

    @abstractmethod
    async def count_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
    ) -> int:
        """Count the neighbours matched by :meth:`read_neighbors` (no sort/pagination)."""

    async def read_neighbors_by_edge_type(
        self,
        vertex_id: str,
        *,
        edge_label: str,
        direction: Literal["in", "out", "both"] = "both",
        filters: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> GraphResponse:
        """Retrieve neighbours reached via a specific edge/relationship type."""
        return await self.read_neighbors(
            vertex_id,
            direction=direction,
            edge_label=edge_label,
            filters=filters,
            sort=sort,
            limit=limit,
            offset=offset,
        )

    async def read_neighbors_by_node_type(
        self,
        vertex_id: str,
        *,
        neighbor_label: str,
        direction: Literal["in", "out", "both"] = "both",
        filters: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> GraphResponse:
        """Retrieve neighbours of a specific node type (label)."""
        return await self.read_neighbors(
            vertex_id,
            direction=direction,
            neighbor_label=neighbor_label,
            filters=filters,
            sort=sort,
            limit=limit,
            offset=offset,
        )

    async def count_neighbors_by_edge_type(
        self,
        vertex_id: str,
        *,
        edge_label: str,
        direction: Literal["in", "out", "both"] = "both",
        filters: FilterGroup | None = None,
    ) -> int:
        """Count the neighbours reached via a specific edge/relationship type."""
        return await self.count_neighbors(vertex_id, direction=direction, edge_label=edge_label, filters=filters)

    async def count_neighbors_by_node_type(
        self,
        vertex_id: str,
        *,
        neighbor_label: str,
        direction: Literal["in", "out", "both"] = "both",
        filters: FilterGroup | None = None,
    ) -> int:
        """Count the neighbours of a specific node type (label)."""
        return await self.count_neighbors(
            vertex_id, direction=direction, neighbor_label=neighbor_label, filters=filters
        )

    @abstractmethod
    async def read_vertex_by_id(self, vertex_id: str) -> Vertex:
        """Retrieve a single vertex by its element ID."""

    @abstractmethod
    async def read_edge_by_id(self, edge_id: str) -> Edge:
        """Retrieve a single edge by its element ID."""

    @abstractmethod
    async def shortest_path(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 10,
    ) -> Path | None:
        """Find the shortest path between two vertices."""

    @abstractmethod
    async def count_vertices(self, label: str | None = None) -> int:
        """Count vertices, optionally filtered by label."""

    @abstractmethod
    async def count_edges(self, label: str | None = None) -> int:
        """Count edges, optionally filtered by relationship type."""
