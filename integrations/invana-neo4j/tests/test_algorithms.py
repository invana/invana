"""Integration tests for Neo4j GDS algorithms queryset."""

import pytest
from invana.graph.connectors.base.data_types.data_elements import Path
from invana.graph.connectors.base.exceptions import NotSupportedError


@pytest.fixture
async def social_graph(connector):
    """Small social network: 5 people, 6 directed edges with weights."""
    alice = await connector.data_writer.create_vertex("Person", {"name": "Alice"})
    bob = await connector.data_writer.create_vertex("Person", {"name": "Bob"})
    charlie = await connector.data_writer.create_vertex("Person", {"name": "Charlie"})
    david = await connector.data_writer.create_vertex("Person", {"name": "David"})
    eve = await connector.data_writer.create_vertex("Person", {"name": "Eve"})

    await connector.data_writer.create_edge("KNOWS", alice.id, bob.id, {"weight": 1.0})
    await connector.data_writer.create_edge("KNOWS", alice.id, charlie.id, {"weight": 2.0})
    await connector.data_writer.create_edge("KNOWS", bob.id, charlie.id, {"weight": 1.5})
    await connector.data_writer.create_edge("KNOWS", charlie.id, david.id, {"weight": 3.0})
    await connector.data_writer.create_edge("KNOWS", david.id, eve.id, {"weight": 1.0})
    await connector.data_writer.create_edge("KNOWS", eve.id, alice.id, {"weight": 2.0})

    return {"alice": alice, "bob": bob, "charlie": charlie, "david": david, "eve": eve}


@pytest.fixture
async def disconnected_graph(connector):
    """Two disconnected components: A-B-C and D-E."""
    a = await connector.data_writer.create_vertex("Node", {"name": "A"})
    b = await connector.data_writer.create_vertex("Node", {"name": "B"})
    c = await connector.data_writer.create_vertex("Node", {"name": "C"})
    d = await connector.data_writer.create_vertex("Node", {"name": "D"})
    e = await connector.data_writer.create_vertex("Node", {"name": "E"})

    await connector.data_writer.create_edge("LINK", a.id, b.id)
    await connector.data_writer.create_edge("LINK", b.id, c.id)
    await connector.data_writer.create_edge("LINK", d.id, e.id)

    return {"a": a, "b": b, "c": c, "d": d, "e": e}


# -- Centrality --


class TestPageRank:
    async def test_returns_all_nodes(self, connector, gds_available, social_graph):
        result = await connector.algorithms.pagerank(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5

    async def test_has_nodeId_and_score(self, connector, gds_available, social_graph):
        result = await connector.algorithms.pagerank(node_label="Person", edge_label="KNOWS")
        for r in result:
            assert "nodeId" in r
            assert "score" in r
            assert isinstance(r["score"], float)
            assert r["score"] > 0

    async def test_ordered_by_score_desc(self, connector, gds_available, social_graph):
        result = await connector.algorithms.pagerank(node_label="Person", edge_label="KNOWS")
        scores = [r["score"] for r in result]
        assert scores == sorted(scores, reverse=True)

    async def test_custom_parameters(self, connector, gds_available, social_graph):
        result = await connector.algorithms.pagerank(
            node_label="Person",
            edge_label="KNOWS",
            damping_factor=0.5,
            max_iterations=5,
        )
        assert len(result) == 5
        assert all(r["score"] > 0 for r in result)


class TestBetweennessCentrality:
    async def test_returns_all_nodes(self, connector, gds_available, social_graph):
        result = await connector.algorithms.betweenness_centrality(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5
        assert all("nodeId" in r and "score" in r for r in result)

    async def test_scores_non_negative(self, connector, gds_available, social_graph):
        result = await connector.algorithms.betweenness_centrality(node_label="Person", edge_label="KNOWS")
        assert all(r["score"] >= 0 for r in result)


class TestClosenessCentrality:
    async def test_returns_all_nodes(self, connector, gds_available, social_graph):
        result = await connector.algorithms.closeness_centrality(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5
        assert all("nodeId" in r and "score" in r for r in result)


class TestEigenvectorCentrality:
    async def test_returns_all_nodes(self, connector, gds_available, social_graph):
        result = await connector.algorithms.eigenvector_centrality(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5
        assert all("nodeId" in r and "score" in r for r in result)


class TestDegreeCentrality:
    """Degree centrality uses the plain Cypher implementation from the base — verify it still works."""

    async def test_returns_all_nodes(self, connector, social_graph):
        result = await connector.algorithms.degree_centrality(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5

    async def test_scores_reflect_degree(self, connector, social_graph):
        result = await connector.algorithms.degree_centrality(node_label="Person", edge_label="KNOWS")
        # All nodes have at least 2 connections in the cycle graph
        assert all(r["score"] >= 2 for r in result)


# -- Community Detection --


class TestLouvain:
    async def test_returns_all_nodes(self, connector, gds_available, social_graph):
        result = await connector.algorithms.louvain(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5
        assert all("nodeId" in r and "communityId" in r for r in result)

    async def test_community_ids_are_integers(self, connector, gds_available, social_graph):
        result = await connector.algorithms.louvain(node_label="Person", edge_label="KNOWS")
        assert all(isinstance(r["communityId"], int) for r in result)


class TestLabelPropagation:
    async def test_returns_all_nodes(self, connector, gds_available, social_graph):
        result = await connector.algorithms.label_propagation(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5
        assert all("nodeId" in r and "communityId" in r for r in result)


class TestConnectedComponents:
    async def test_single_component(self, connector, gds_available, social_graph):
        result = await connector.algorithms.connected_components(node_label="Person", edge_label="KNOWS")
        assert len(result) == 5
        component_ids = {r["componentId"] for r in result}
        # All 5 nodes in a cycle should be in the same component
        assert len(component_ids) == 1

    async def test_two_components(self, connector, gds_available, disconnected_graph):
        result = await connector.algorithms.connected_components(node_label="Node", edge_label="LINK")
        assert len(result) == 5
        component_ids = {r["componentId"] for r in result}
        assert len(component_ids) == 2


class TestStronglyConnectedComponents:
    async def test_not_supported(self, connector, gds_available, social_graph):
        with pytest.raises(NotSupportedError):
            await connector.algorithms.strongly_connected_components(node_label="Person", edge_label="KNOWS")


# -- Pathfinding --


class TestDijkstra:
    async def test_finds_shortest_weighted_path(self, connector, gds_available, social_graph):
        alice = social_graph["alice"]
        david = social_graph["david"]
        path = await connector.algorithms.dijkstra(source_id=alice.id, target_id=david.id, weight_property="weight")
        assert path is not None
        assert isinstance(path, Path)
        assert len(path.vertices) >= 2
        assert len(path.edges) >= 1

    async def test_returns_none_for_unreachable(self, connector, gds_available, disconnected_graph):
        a = disconnected_graph["a"]
        d = disconnected_graph["d"]
        path = await connector.algorithms.dijkstra(source_id=a.id, target_id=d.id, weight_property="weight")
        assert path is None


class TestAllShortestPaths:
    """Uses the base Cypher implementation — verify it still works through Neo4jConnector."""

    async def test_finds_paths(self, connector, social_graph):
        alice = social_graph["alice"]
        david = social_graph["david"]
        paths = await connector.algorithms.all_shortest_paths(source_id=alice.id, target_id=david.id)
        assert len(paths) >= 1
        assert all(isinstance(p, Path) for p in paths)


class TestBFS:
    """Uses the base Cypher implementation — verify it still works through Neo4jConnector."""

    async def test_finds_reachable_nodes(self, connector, social_graph):
        alice = social_graph["alice"]
        vertices = await connector.algorithms.bfs(source_id=alice.id, max_depth=3)
        assert len(vertices) >= 2


class TestAStar:
    async def test_not_supported(self, connector, gds_available, social_graph):
        with pytest.raises(NotSupportedError):
            await connector.algorithms.a_star(
                source_id=social_graph["alice"].id,
                target_id=social_graph["bob"].id,
            )


# -- Similarity --


class TestJaccardSimilarity:
    async def test_returns_similarity_pairs(self, connector, gds_available, social_graph):
        result = await connector.algorithms.jaccard_similarity(node_label="Person", edge_label="KNOWS", top_k=5)
        assert isinstance(result, list)
        for r in result:
            assert "node1" in r
            assert "node2" in r
            assert "similarity" in r
            assert 0 <= r["similarity"] <= 1

    async def test_similarity_ordered_desc(self, connector, gds_available, social_graph):
        result = await connector.algorithms.jaccard_similarity(node_label="Person", edge_label="KNOWS", top_k=5)
        if len(result) >= 2:
            similarities = [r["similarity"] for r in result]
            assert similarities == sorted(similarities, reverse=True)


class TestCosineSimilarity:
    async def test_not_supported(self, connector, gds_available, social_graph):
        with pytest.raises(NotSupportedError):
            await connector.algorithms.cosine_similarity(node_label="Person", property_name="embedding")
