"""Neo4j GDS-powered algorithms queryset.

Overrides the @not_supported_by_vendor methods from OpenCypherAlgorithmsQuerySet
with Neo4j Graph Data Science (GDS) procedure calls.
Requires the GDS plugin to be installed in the Neo4j instance.
"""

from __future__ import annotations

import contextlib
import uuid
from typing import Any

from invana.graph.connectors.base.data_types.data_elements import Path
from invana.graph.connectors.base.decorators import not_supported_by_vendor
from invana.graph.connectors.base.exceptions import QueryExecutionError
from invana.graph.connectors.cypher.querysets.algorithms import OpenCypherAlgorithmsQuerySet


class Neo4jAlgorithmsQuerySet(OpenCypherAlgorithmsQuerySet):
    """Neo4j GDS-powered algorithms.

    Uses graph projections for each algorithm call (project → stream → drop).
    Inherits plain-Cypher implementations from the base for:
    degree_centrality, all_shortest_paths, bfs.
    """

    async def _project_graph(self, node_label: str, edge_label: str) -> str:
        name = f"_invana_{uuid.uuid4().hex[:8]}"
        await self._connector.execute(
            "CALL gds.graph.project($name, $node, $rel)",
            {"name": name, "node": node_label, "rel": edge_label},
        )
        return name

    async def _drop_projection(self, name: str) -> None:
        with contextlib.suppress(QueryExecutionError):
            await self._connector.execute("CALL gds.graph.drop($name)", {"name": name})

    async def _run_centrality(
        self, algo: str, node_label: str, edge_label: str, config: dict | None = None
    ) -> list[dict[str, Any]]:
        proj = await self._project_graph(node_label, edge_label)
        try:
            raw = await self._connector.execute(
                f"CALL gds.{algo}.stream($name, $config) YIELD nodeId, score "
                "RETURN gds.util.asNode(nodeId) AS node, score ORDER BY score DESC",
                {"name": proj, "config": config or {}},
            )
            return [{"nodeId": self._serializer.deserialize_vertex(r["node"]).id, "score": r["score"]} for r in raw]
        finally:
            await self._drop_projection(proj)

    # -- Centrality --

    async def pagerank(
        self,
        *,
        node_label: str,
        edge_label: str,
        damping_factor: float = 0.85,
        max_iterations: int = 20,
        tolerance: float = 1e-6,
    ) -> list[dict[str, Any]]:
        return await self._run_centrality(
            "pageRank",
            node_label,
            edge_label,
            {"dampingFactor": damping_factor, "maxIterations": max_iterations, "tolerance": tolerance},
        )

    async def betweenness_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        return await self._run_centrality("betweenness", node_label, edge_label)

    async def closeness_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        return await self._run_centrality("closeness", node_label, edge_label)

    async def eigenvector_centrality(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        return await self._run_centrality("eigenvector", node_label, edge_label)

    # -- Community Detection --

    async def _run_community(self, algo: str, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        proj = await self._project_graph(node_label, edge_label)
        try:
            raw = await self._connector.execute(
                f"CALL gds.{algo}.stream($name) YIELD nodeId, communityId "
                "RETURN gds.util.asNode(nodeId) AS node, communityId",
                {"name": proj},
            )
            return [
                {"nodeId": self._serializer.deserialize_vertex(r["node"]).id, "communityId": r["communityId"]}
                for r in raw
            ]
        finally:
            await self._drop_projection(proj)

    async def louvain(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        return await self._run_community("louvain", node_label, edge_label)

    async def label_propagation(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        return await self._run_community("labelPropagation", node_label, edge_label)

    async def connected_components(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]:
        """WCC via GDS — more efficient than the base Cypher path-traversal approach."""
        proj = await self._project_graph(node_label, edge_label)
        try:
            raw = await self._connector.execute(
                "CALL gds.wcc.stream($name) YIELD nodeId, componentId "
                "RETURN gds.util.asNode(nodeId) AS node, componentId",
                {"name": proj},
            )
            return [
                {"nodeId": self._serializer.deserialize_vertex(r["node"]).id, "componentId": r["componentId"]}
                for r in raw
            ]
        finally:
            await self._drop_projection(proj)

    @not_supported_by_vendor("Strongly connected components is not available in GDS Community.")
    async def strongly_connected_components(self, *, node_label: str, edge_label: str) -> list[dict[str, Any]]: ...

    # -- Pathfinding --

    async def dijkstra(self, *, source_id: str, target_id: str, weight_property: str = "weight") -> Path | None:
        proj = f"_invana_{uuid.uuid4().hex[:8]}"
        try:
            await self._connector.execute(
                "CALL gds.graph.project($name, '*', '*', $config)",
                {"name": proj, "config": {"relationshipProperties": weight_property}},
            )
            raw = await self._connector.execute(
                "MATCH (source) WHERE elementId(source) = $sourceId "
                "MATCH (target) WHERE elementId(target) = $targetId "
                "CALL gds.shortestPath.dijkstra.stream($name, {"
                "  sourceNode: source, targetNode: target,"
                f"  relationshipWeightProperty: '{weight_property}'"
                "}) YIELD path RETURN path",
                {"name": proj, "sourceId": source_id, "targetId": target_id},
            )
            if not raw:
                return None
            return self._serializer.deserialize_path(raw[0]["path"])
        finally:
            await self._drop_projection(proj)

    @not_supported_by_vendor("A* pathfinding requires latitude/longitude projection — use dijkstra instead.")
    async def a_star(
        self,
        *,
        source_id: str,
        target_id: str,
        weight_property: str = "weight",
        latitude_property: str = "latitude",
        longitude_property: str = "longitude",
    ) -> Path | None: ...

    # -- Similarity --

    async def jaccard_similarity(self, *, node_label: str, edge_label: str, top_k: int = 10) -> list[dict[str, Any]]:
        proj = await self._project_graph(node_label, edge_label)
        try:
            raw = await self._connector.execute(
                "CALL gds.nodeSimilarity.stream($name, $config) "
                "YIELD node1, node2, similarity "
                "RETURN gds.util.asNode(node1) AS nodeA, gds.util.asNode(node2) AS nodeB, similarity "
                "ORDER BY similarity DESC",
                {"name": proj, "config": {"topK": top_k}},
            )
            return [
                {
                    "node1": self._serializer.deserialize_vertex(r["nodeA"]).id,
                    "node2": self._serializer.deserialize_vertex(r["nodeB"]).id,
                    "similarity": r["similarity"],
                }
                for r in raw
            ]
        finally:
            await self._drop_projection(proj)

    @not_supported_by_vendor("Cosine similarity on node properties requires KNN — not yet implemented.")
    async def cosine_similarity(
        self, *, node_label: str, property_name: str, top_k: int = 10
    ) -> list[dict[str, Any]]: ...
