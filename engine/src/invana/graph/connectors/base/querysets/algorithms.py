from abc import ABC, abstractmethod
from typing import Any

from invana.graph.connectors.base.data_types.data_elements import Path, Vertex
from invana.graph.connectors.base.querysets.base import BaseQuerySet


class BaseAlgorithmsQuerySet(BaseQuerySet, ABC):
    # -- Centrality --
    @abstractmethod
    async def pagerank(
        self,
        *,
        node_label: str,
        edge_label: str,
        damping_factor: float = 0.85,
        max_iterations: int = 20,
        tolerance: float = 1e-6,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def betweenness_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def closeness_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def degree_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def eigenvector_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    # -- Community Detection --
    @abstractmethod
    async def louvain(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def label_propagation(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def connected_components(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def strongly_connected_components(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]: ...

    # -- Pathfinding --
    @abstractmethod
    async def dijkstra(
        self,
        *,
        source_id: str,
        target_id: str,
        weight_property: str = "weight",
    ) -> Path | None: ...

    @abstractmethod
    async def a_star(
        self,
        *,
        source_id: str,
        target_id: str,
        weight_property: str = "weight",
        latitude_property: str = "latitude",
        longitude_property: str = "longitude",
    ) -> Path | None: ...

    @abstractmethod
    async def all_shortest_paths(
        self,
        *,
        source_id: str,
        target_id: str,
    ) -> list[Path]: ...

    @abstractmethod
    async def bfs(
        self,
        *,
        source_id: str,
        target_label: str | None = None,
        max_depth: int = 10,
    ) -> list[Vertex]: ...

    # -- Similarity --
    @abstractmethod
    async def jaccard_similarity(
        self,
        *,
        node_label: str,
        edge_label: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def cosine_similarity(
        self,
        *,
        node_label: str,
        property_name: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]: ...
