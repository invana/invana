from abc import ABC, abstractmethod
from typing import Literal

from invana.graph.connectors.base.data_types.data_elements import Vertex
from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseVectorQuerySet(BaseQuerySet, ABC):
    @abstractmethod
    async def create_vector_index(
        self,
        label: str,
        property_name: str,
        *,
        dimensions: int,
        similarity: Literal["cosine", "euclidean"] = "cosine",
        name: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def drop_vector_index(self, name: str) -> None: ...

    @abstractmethod
    async def similarity_search(
        self,
        label: str,
        embedding: list[float],
        *,
        top_k: int = 10,
        property_name: str = "embedding",
    ) -> list[Vertex]: ...
