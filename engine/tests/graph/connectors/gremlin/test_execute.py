"""Integration tests for raw Gremlin script execution.

`execute()` is the one door an arbitrary query comes through, in both families
(docs/for-developers/modules/graph-connectors/features/languages.md LG5). Until
this path existed, asking a Gremlin-backed Graph a question reached
``NotImplementedError`` at the last step.

Against a live Gremlin server — no mocks (CLAUDE.md rule 7).
"""

import pytest

from invana.graph.connectors.base.exceptions import (
    LensViolationError,
    QueryErrorCategory,
    QueryExecutionError,
)
from invana.graph.types.lens import QueryLens, TypeBound


@pytest.fixture
async def seeded(connector):
    """Two people, one of whom is findable by a bound parameter."""
    alice = await connector.data_writer.create_vertex("Person", {"name": "Alice", "age": 30})
    bob = await connector.data_writer.create_vertex("Person", {"name": "Bob", "age": 25})
    return {"alice": alice, "bob": bob}


class TestExecuteScript:
    async def test_scalar_result_is_a_record(self, connector, seeded):
        """A count is a row, not a node — and it must not be dropped (LG8)."""
        response = await connector.execute("g.V().hasLabel('Person').count()")

        assert response.records == [{"value": 2}]
        assert response.nodes == []
        assert response.metadata.duration_ms > 0

    async def test_elements_become_nodes(self, connector, seeded):
        """A script returning elements feeds the canvas, exactly as Cypher's does."""
        response = await connector.execute("g.V().hasLabel('Person').elementMap()")

        assert len(response.nodes) == 2
        assert {v.properties["name"] for v in response.nodes} == {"Alice", "Bob"}

    async def test_parameters_ride_as_bindings(self, connector, seeded):
        """A value is bound, never spliced into the script text (CN7)."""
        response = await connector.execute(
            "g.V().hasLabel('Person').has('name', wanted).values('age')",
            parameters={"wanted": "Alice"},
        )

        assert response.records == [{"value": 30}]


class TestALensRefuses:
    """Gremlin has no governed path, so a lens refuses rather than not applying (CC12)."""

    async def test_a_query_under_a_lens_is_refused_naming_the_language(self, connector):
        lens = QueryLens(
            bounds={"Person": TypeBound("Person", declared=frozenset({"name", "age"}), excluded=frozenset({"age"}))}
        )
        with pytest.raises(LensViolationError) as caught:
            await connector.execute("g.V().hasLabel('Person').elementMap()", lens=lens)

        assert caught.value.code == "lens_not_supported"
        assert "Gremlin" in str(caught.value)

    async def test_a_lens_that_narrows_nothing_does_not_refuse(self, connector, seeded):
        """The widest lens is the default, and it must not break a Gremlin graph (GV7)."""
        response = await connector.execute("g.V().hasLabel('Person').count()", lens=QueryLens())

        assert response.records == [{"value": 2}]


class TestExecuteRefuses:
    async def test_a_broken_script_is_a_query_failure(self, connector):
        """Classified like a Cypher syntax error, not surfaced as a driver crash."""
        with pytest.raises(QueryExecutionError) as caught:
            await connector.execute("g.V().thisStepDoesNotExist()")

        assert caught.value.category in {QueryErrorCategory.SYNTAX, QueryErrorCategory.UNKNOWN}

    async def test_a_timeout_is_a_timeout(self, connector, seeded):
        """A budget the server blows through comes back as a timeout, not unknown."""
        with pytest.raises(QueryExecutionError) as caught:
            await connector.execute("Thread.sleep(3000); g.V().count()", timeout_s=0.25)

        assert caught.value.category == QueryErrorCategory.TIMEOUT
