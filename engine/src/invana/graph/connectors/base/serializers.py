"""Base serializer abstract class."""

from abc import ABC, abstractmethod
from typing import Any

from invana.graph.connectors.base.data_types.data_elements import Edge, GraphResponse, Path, Vertex


class BaseSerializer(ABC):
    """Abstract base for converting raw driver results into Pydantic data types."""

    @abstractmethod
    def deserialize_vertex(self, raw: Any) -> Vertex:
        """Convert a raw driver node record into a Vertex."""

    @abstractmethod
    def deserialize_edge(self, raw: Any) -> Edge:
        """Convert a raw driver relationship record into an Edge."""

    @abstractmethod
    def deserialize_path(self, raw: Any) -> Path:
        """Convert a raw driver path record into a Path."""

    @abstractmethod
    def deserialize_graph_response(self, raw: Any) -> GraphResponse:
        """Convert raw query result records into a GraphResponse."""
