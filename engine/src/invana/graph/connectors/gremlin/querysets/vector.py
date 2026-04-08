"""Gremlin vector queryset — not supported at the base level."""

from typing import Any

from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.querysets.vector import BaseVectorQuerySet


class GremlinVectorQuerySet(BaseVectorQuerySet):
    """Gremlin vector search queryset — all methods not supported.

    Vector search is not part of the Gremlin spec.
    """

    @not_supported_by_vendor("Vector search requires vendor-specific support.")
    async def create_vector_index(
        self,
        label: str,
        property_name: str,
        *,
        dimensions: int,
        similarity_function: str = "cosine",
        name: str | None = None,
        **kwargs: Any,
    ) -> None: ...

    @not_supported_by_vendor("Vector search requires vendor-specific support.")
    async def drop_vector_index(self, name: str) -> None: ...

    @not_supported_by_vendor("Vector search requires vendor-specific support.")
    async def similarity_search(
        self,
        label: str,
        property_name: str,
        query_vector: list[float],
        *,
        top_k: int = 10,
        **kwargs: Any,
    ) -> list[dict[str, Any]]: ...
