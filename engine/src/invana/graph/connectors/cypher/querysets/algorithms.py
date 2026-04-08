"""OpenCypher graph algorithms queryset implementation."""

from typing import Any

from invana.graph.connectors.base.data_types.data_elements import Path, Vertex
from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.querysets.algorithms import BaseAlgorithmsQuerySet


class OpenCypherAlgorithmsQuerySet(BaseAlgorithmsQuerySet):
    """Standard openCypher algorithm implementations.

    Most graph algorithms are NOT part of the openCypher standard — they require
    vendor-specific extensions (Neo4j GDS, Memgraph MAGE). This base provides
    the algorithms expressible in standard Cypher and marks the rest as not supported.

    Integration packages override specific methods with vendor-native implementations.
    """

    # -- Centrality (require vendor extensions) --
    @not_supported_by_vendor("PageRank requires a vendor extension (e.g. Neo4j GDS, Memgraph MAGE).")
    async def pagerank(self, *, node_label: str, edge_label: str, **kwargs: Any) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Betweenness centrality requires a vendor extension.")
    async def betweenness_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Closeness centrality requires a vendor extension.")
    async def closeness_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    async def degree_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        """Degree centrality — expressible in standard Cypher."""
        query = (
            f"MATCH (n:`{node_label}`)"
            f" OPTIONAL MATCH (n)-[r:`{edge_label}`]-()"
            " RETURN elementId(n) AS nodeId, n AS node, count(r) AS degree"
            " ORDER BY degree DESC"
        )
        raw = await self._connector.execute(query)
        return [{"nodeId": record["nodeId"], "score": record["degree"]} for record in raw]

    @not_supported_by_vendor("Eigenvector centrality requires a vendor extension.")
    async def eigenvector_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    # -- Community Detection (require vendor extensions) --
    @not_supported_by_vendor("Louvain community detection requires a vendor extension.")
    async def louvain(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Label propagation requires a vendor extension.")
    async def label_propagation(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    async def connected_components(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        """Weak connected components — expressible via path traversal in Cypher."""
        # This is a simplified BFS-based approach.
        # For large graphs, vendor-native implementations are far more efficient.
        query = (
            f"MATCH (n:`{node_label}`)"
            f" OPTIONAL MATCH path = (n)-[:`{edge_label}`*]-(m:`{node_label}`)"
            " WITH n, collect(DISTINCT m) AS component"
            " RETURN elementId(n) AS nodeId, [x IN component | elementId(x)] AS componentMembers"
        )
        raw = await self._connector.execute(query)
        return [{"nodeId": record["nodeId"], "component": record["componentMembers"]} for record in raw]

    @not_supported_by_vendor("Strongly connected components requires a vendor extension.")
    async def strongly_connected_components(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    # -- Pathfinding (some expressible in Cypher) --
    @not_supported_by_vendor("Dijkstra weighted shortest path requires a vendor extension.")
    async def dijkstra(self, *, source_id: str, target_id: str, weight_property: str = "weight") -> Path | None: ...

    @not_supported_by_vendor("A* pathfinding requires a vendor extension.")
    async def a_star(
        self,
        *,
        source_id: str,
        target_id: str,
        weight_property: str = "weight",
        latitude_property: str = "latitude",
        longitude_property: str = "longitude",
    ) -> Path | None: ...

    async def all_shortest_paths(self, *, source_id: str, target_id: str) -> list[Path]:
        """All shortest paths — standard Cypher."""
        query = (
            "MATCH (a), (b)"
            " WHERE elementId(a) = $sid AND elementId(b) = $tid"
            " MATCH p = allShortestPaths((a)-[*]-(b))"
            " RETURN p"
        )
        raw = await self._connector.execute(query, {"sid": source_id, "tid": target_id})
        return [self._serializer.deserialize_path(record["p"]) for record in raw]

    async def bfs(
        self,
        *,
        source_id: str,
        target_label: str | None = None,
        max_depth: int = 10,
    ) -> list[Vertex]:
        """BFS traversal — expressible in Cypher via variable-length paths."""
        target_filter = f":`{target_label}`" if target_label else ""
        query = (
            "MATCH (start) WHERE elementId(start) = $sid"
            f" MATCH path = (start)-[*1..{max_depth}]-(target{target_filter})"
            " WITH target, min(length(path)) AS dist"
            " ORDER BY dist"
            " RETURN DISTINCT target"
        )
        raw = await self._connector.execute(query, {"sid": source_id})
        return [self._serializer.deserialize_vertex(record["target"]) for record in raw]

    # -- Similarity (require vendor extensions) --
    @not_supported_by_vendor("Jaccard similarity requires a vendor extension.")
    async def jaccard_similarity(
        self, *, node_label: str, edge_label: str, top_k: int = 10
    ) -> list[dict[str, Any]]: ...

    @not_supported_by_vendor("Cosine similarity requires a vendor extension.")
    async def cosine_similarity(
        self, *, node_label: str, property_name: str, top_k: int = 10
    ) -> list[dict[str, Any]]: ...
