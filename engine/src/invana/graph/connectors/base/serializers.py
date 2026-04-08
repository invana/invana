from abc import ABC, abstractmethod
from typing import Any

from invana.graph.connectors.base.data_types.data_elements import Edge, GraphResponse, Path, Vertex


class BaseSerializer(ABC):
    @abstractmethod
    def deserialize_vertex(self, raw: Any) -> Vertex: ...

    @abstractmethod
    def deserialize_edge(self, raw: Any) -> Edge: ...

    @abstractmethod
    def deserialize_path(self, raw: Any) -> Path: ...

    @abstractmethod
    def deserialize_graph_response(self, raw: Any) -> GraphResponse: ...
