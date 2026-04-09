"""OpenCypher vector search queryset implementation."""

from typing import Literal

from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.querysets.vector import BaseVectorQuerySet
from invana.graph.types.data_elements import Vertex


class OpenCypherVectorQuerySet(BaseVectorQuerySet):
    """Standard openCypher has no vector search support.

    All methods raise NotSupportedError by default.
    Integration packages (e.g. invana-neo4j) override with vendor-native implementations.
    """

    @not_supported_by_vendor("Vector indexes are not part of standard openCypher.")
    async def create_vector_index(
        self,
        label: str,
        property_name: str,
        *,
        dimensions: int,
        similarity: Literal["cosine", "euclidean"] = "cosine",
        name: str | None = None,
    ) -> None: ...

    @not_supported_by_vendor("Vector indexes are not part of standard openCypher.")
    async def drop_vector_index(self, name: str) -> None: ...

    @not_supported_by_vendor("Vector search is not part of standard openCypher.")
    async def similarity_search(
        self,
        label: str,
        embedding: list[float],
        *,
        top_k: int = 10,
        property_name: str = "embedding",
    ) -> list[Vertex]: ...
