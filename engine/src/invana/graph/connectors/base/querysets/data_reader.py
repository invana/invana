from abc import ABC, abstractmethod
from typing import Literal

from invana.graph.connectors.base.data_types.data_elements import Edge, GraphResponse, Path, Vertex
from invana.graph.connectors.base.data_types.filters import FilterGroup
from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseDataReaderQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def read_vertices(
        self,
        label: str,
        *,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[Vertex]: ...

    @abstractmethod
    async def read_edges(
        self,
        label: str,
        *,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> list[Edge]: ...

    @abstractmethod
    async def read_neighbors(
        self,
        vertex_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        edge_label: str | None = None,
        limit: int | None = None,
    ) -> GraphResponse: ...

    @abstractmethod
    async def read_vertex_by_id(self, vertex_id: str) -> Vertex: ...

    @abstractmethod
    async def read_edge_by_id(self, edge_id: str) -> Edge: ...

    @abstractmethod
    async def shortest_path(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 10,
    ) -> Path | None: ...

    @abstractmethod
    async def count_vertices(self, label: str | None = None) -> int: ...

    @abstractmethod
    async def count_edges(self, label: str | None = None) -> int: ...
