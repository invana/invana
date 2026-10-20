"""Abstract data-writing queryset."""

from abc import ABC, abstractmethod

from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.data_elements import Edge, Vertex


class BaseDataWriterQuerySet(BaseQuerySet, ABC):
    """Abstract interface for writing graph data."""

    @abstractmethod
    async def create_vertex(self, label: str, properties: dict) -> Vertex:
        """Create a new vertex with the given label and properties."""

    @abstractmethod
    async def create_edge(
        self,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> Edge:
        """Create an edge between two existing vertices."""

    @abstractmethod
    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex:
        """Merge-update vertex properties."""

    @abstractmethod
    async def update_edge(self, edge_id: str, properties: dict) -> Edge:
        """Merge-update edge properties."""

    @abstractmethod
    async def delete_vertex(self, vertex_id: str) -> None:
        """Delete a vertex and all its connected edges."""

    @abstractmethod
    async def delete_edge(self, edge_id: str) -> None:
        """Delete a single edge."""

    async def relabel_vertex(self, vertex_id: str, old_label: str, new_label: str) -> None:
        """Give a vertex a new label in place of ``old_label``.

        Not every database can: a Gremlin vertex's label is fixed when it is
        created. Those raise ``NotImplementedError``, and a caller says so.
        """
        raise NotImplementedError("This database cannot change a vertex's label.")

    async def unset_vertex_properties(self, vertex_id: str, keys: list[str]) -> None:
        """Remove ``keys`` from a vertex; a key it does not have is ignored."""
        raise NotImplementedError("This database cannot remove a vertex's properties.")

    async def unset_edge_properties(self, edge_id: str, keys: list[str]) -> None:
        """Remove ``keys`` from an edge; a key it does not have is ignored."""
        raise NotImplementedError("This database cannot remove an edge's properties.")
