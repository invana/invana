"""Abstract vector search queryset."""

from abc import ABC, abstractmethod
from typing import Literal

from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.data_elements import Vertex


class BaseVectorQuerySet(BaseQuerySet, ABC):
    """Abstract interface for vector index management and similarity search."""

    @abstractmethod
    async def create_vector_index(
        self,
        label: str,
        property_name: str,
        *,
        dimensions: int,
        similarity: Literal["cosine", "euclidean"] = "cosine",
        name: str | None = None,
    ) -> None:
        """Create a vector index on a node property."""

    @abstractmethod
    async def drop_vector_index(self, name: str) -> None:
        """Drop a vector index by name."""

    @abstractmethod
    async def similarity_search(
        self,
        label: str,
        embedding: list[float],
        *,
        top_k: int = 10,
        property_name: str = "embedding",
    ) -> list[Vertex]:
        """Search for vertices with the most similar vector embeddings."""
