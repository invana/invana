"""Memgraph's openCypher dialect — one function's worth of difference.

Memgraph speaks Bolt and openCypher, so it shares ~80% of its query logic with
Neo4j and rides the same driver. What it does not share is **identity**:
``elementId()`` is Neo4j 5's, and Memgraph does not have it at all. It has
``id()``, which returns an **integer** rather than a string
(docs/for-developers/modules/graph-connectors/features/languages.md LG10).
"""

from __future__ import annotations

from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder


class MemgraphQueryBuilder(OpenCypherQueryBuilder):
    """openCypher, with Memgraph's identity function and its own shortest path."""

    ELEMENT_ID = "id"

    @classmethod
    def shortest_path(cls, source_id: str, target_id: str, max_depth: int = 10) -> tuple[str, dict]:
        """Memgraph writes a shortest path as a BFS expansion, not ``shortestPath()``.

        `shortestPath()` is Neo4j's and Memgraph does not parse it. The capability
        is there — it is spelled ``-[*BFS ..n]-``, which returns the same shortest
        unweighted path — so this is an override, not a refusal (CC3).
        """
        return (
            f"MATCH (a), (b) WHERE {cls.ELEMENT_ID}(a) = $sid AND {cls.ELEMENT_ID}(b) = $tid"
            f" MATCH p = (a)-[*BFS ..{max_depth}]-(b) RETURN p",
            {"sid": source_id, "tid": target_id},
        )
