from abc import ABC, abstractmethod

from invana.graph.connectors.base.data_types.data_elements import Edge, Vertex
from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseDataWriterQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def create_vertex(self, label: str, properties: dict) -> Vertex: ...

    @abstractmethod
    async def create_edge(
        self,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> Edge: ...

    @abstractmethod
    async def update_vertex(self, vertex_id: str, properties: dict) -> Vertex: ...

    @abstractmethod
    async def update_edge(self, edge_id: str, properties: dict) -> Edge: ...

    @abstractmethod
    async def delete_vertex(self, vertex_id: str) -> None: ...

    @abstractmethod
    async def delete_edge(self, edge_id: str) -> None: ...
