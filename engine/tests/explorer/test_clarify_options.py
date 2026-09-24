"""A clarification's options are read under the run's lens (clarifying-questions.md CQ11).

Here beside the explorer's tests because they carry the live-graph fixtures —
a Graph whose Neo4j connector is registered — and this is a read of that graph.
"""

from __future__ import annotations

import pytest

from invana.apps.llm.clarify import ground_options
from invana.graph.types.lens import QueryLens, TypeBound

pytestmark = pytest.mark.asyncio

NO_AGES = QueryLens(
    bounds={"Person": TypeBound(type_name="Person", declared=frozenset({"name", "age"}), excluded=frozenset({"age"}))}
)


async def _options(session, graph, manager, user, query, lens=None):
    return await ground_options(
        session,
        graph=graph,
        manager=manager,
        options_query=query,
        fallback=["any"],
        actor_id=user.id,
        session_id=None,
        timeout_s=None,
        language="cypher",
        lens=lens,
    )


async def test_the_options_come_from_the_graph(session, graph, manager, user, seeded_graph):
    options, result = await _options(session, graph, manager, user, "MATCH (p:Person) RETURN p.name ORDER BY p.name")
    assert options == ["Alice", "Bob", "Charlie"]
    assert result is not None


async def test_what_the_world_excludes_is_never_offered(session, graph, manager, user, seeded_graph):
    """A property the lens excludes is refused before the wire; the fixed options stand."""
    options, result = await _options(session, graph, manager, user, "MATCH (p:Person) RETURN p.age", lens=NO_AGES)
    assert (options, result) == (["any"], None)


async def test_a_query_that_writes_is_never_sent(session, graph, manager, user, seeded_graph):
    options, result = await _options(session, graph, manager, user, "MATCH (p:Person) DETACH DELETE p RETURN 1")
    assert (options, result) == (["any"], None)
    still, _ = await _options(session, graph, manager, user, "MATCH (p:Person) RETURN p.name ORDER BY p.name")
    assert still == ["Alice", "Bob", "Charlie"]
