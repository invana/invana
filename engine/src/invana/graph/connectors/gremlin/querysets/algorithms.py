"""Gremlin graph algorithms queryset — not implemented at the base level."""

from typing import Any

from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.querysets.algorithms import BaseAlgorithmsQuerySet
from invana.graph.types.data_elements import Path, Vertex


class GremlinAlgorithmsQuerySet(BaseAlgorithmsQuerySet):
    """Gremlin algorithms queryset — all methods not supported at the base level.

    Graph algorithms are not part of the Gremlin spec. Vendor connectors
    (e.g., JanusGraph with OLAP, Neptune with analytics) should override.
    """

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def pagerank(self, *, node_label: str, edge_label: str, **kwargs: Any) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def betweenness_centrality(
        self, *, node_label: str, edge_label: str, **kwargs: Any
    ) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def closeness_centrality(
        self, *, node_label: str, edge_label: str, **kwargs: Any
    ) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def degree_centrality(self, *, node_label: str, edge_label: str, **kwargs: Any) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def eigenvector_centrality(
        self, *, node_label: str, edge_label: str, **kwargs: Any
    ) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def louvain(self, *, node_label: str, edge_label: str, **kwargs: Any) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def label_propagation(self, *, node_label: str, edge_label: str, **kwargs: Any) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def connected_components(
        self, *, node_label: str, edge_label: str, **kwargs: Any
    ) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def strongly_connected_components(
        self, *, node_label: str, edge_label: str, **kwargs: Any
    ) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def dijkstra(
        self,
        source_id: str,
        target_id: str,
        *,
        weight_property: str = "weight",
        **kwargs: Any,
    ) -> Path | None: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def a_star(
        self,
        source_id: str,
        target_id: str,
        *,
        weight_property: str = "weight",
        lat_property: str = "lat",
        lon_property: str = "lon",
        **kwargs: Any,
    ) -> Path | None: ...

    @not_supported_by_vendor("Use data_reader.shortest_path() for basic shortest path.")
    async def all_shortest_paths(
        self,
        source_id: str,
        target_id: str,
        **kwargs: Any,
    ) -> list[Path]: ...

    @not_supported_by_vendor("Use data_reader.read_neighbors() with Gremlin traversals.")
    async def bfs(
        self,
        source_id: str,
        *,
        max_depth: int = 5,
        **kwargs: Any,
    ) -> list[Vertex]: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def jaccard_similarity(
        self,
        vertex_id_a: str,
        vertex_id_b: str,
        *,
        edge_label: str,
        **kwargs: Any,
    ) -> float: ...

    @not_supported_by_vendor("Graph algorithms require vendor-specific OLAP support.")
    async def cosine_similarity(
        self,
        vertex_id_a: str,
        vertex_id_b: str,
        *,
        properties: list[str],
        **kwargs: Any,
    ) -> float: ...
