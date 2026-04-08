from abc import ABC, abstractmethod

from invana.graph.connectors.base.data_types.data_elements import Edge, Vertex
from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseBulkQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def bulk_create_vertices(self, label: str, records: list[dict]) -> list[Vertex]: ...

    @abstractmethod
    async def bulk_create_edges(self, label: str, records: list[dict]) -> list[Edge]: ...

    @abstractmethod
    async def bulk_delete_vertices(self, vertex_ids: list[str]) -> int: ...

    @abstractmethod
    async def bulk_delete_edges(self, edge_ids: list[str]) -> int: ...
