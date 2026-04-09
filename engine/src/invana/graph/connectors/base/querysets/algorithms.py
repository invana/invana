"""Abstract graph algorithms queryset."""

from abc import ABC, abstractmethod
from typing import Any

from invana.graph.connectors.base.querysets.base import BaseQuerySet
from invana.graph.types.data_elements import Path, Vertex


class BaseAlgorithmsQuerySet(BaseQuerySet, ABC):
    """Abstract interface for graph algorithms.

    Categories: centrality, community detection, pathfinding, and similarity.
    """

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
    ) -> list[dict[str, Any]]:
        """Compute PageRank scores."""

    @abstractmethod
    async def betweenness_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Compute betweenness centrality."""

    @abstractmethod
    async def closeness_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Compute closeness centrality."""

    @abstractmethod
    async def degree_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Compute degree centrality."""

    @abstractmethod
    async def eigenvector_centrality(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Compute eigenvector centrality."""

    # -- Community Detection --
    @abstractmethod
    async def louvain(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Louvain modularity-based community detection."""

    @abstractmethod
    async def label_propagation(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Label propagation community detection."""

    @abstractmethod
    async def connected_components(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Weakly connected components."""

    @abstractmethod
    async def strongly_connected_components(
        self,
        *,
        node_label: str,
        edge_label: str,
    ) -> list[dict[str, Any]]:
        """Strongly connected components."""

    # -- Pathfinding --
    @abstractmethod
    async def dijkstra(
        self,
        *,
        source_id: str,
        target_id: str,
        weight_property: str = "weight",
    ) -> Path | None:
        """Shortest weighted path using Dijkstra's algorithm."""

    @abstractmethod
    async def a_star(
        self,
        *,
        source_id: str,
        target_id: str,
        weight_property: str = "weight",
        latitude_property: str = "latitude",
        longitude_property: str = "longitude",
    ) -> Path | None:
        """A* pathfinding with geographic heuristic."""

    @abstractmethod
    async def all_shortest_paths(
        self,
        *,
        source_id: str,
        target_id: str,
    ) -> list[Path]:
        """Find all shortest paths between two vertices."""

    @abstractmethod
    async def bfs(
        self,
        *,
        source_id: str,
        target_label: str | None = None,
        max_depth: int = 10,
    ) -> list[Vertex]:
        """Breadth-first search from a source vertex."""

    # -- Similarity --
    @abstractmethod
    async def jaccard_similarity(
        self,
        *,
        node_label: str,
        edge_label: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """Jaccard similarity based on shared neighbors."""

    @abstractmethod
    async def cosine_similarity(
        self,
        *,
        node_label: str,
        property_name: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """Cosine similarity based on a vector property."""
