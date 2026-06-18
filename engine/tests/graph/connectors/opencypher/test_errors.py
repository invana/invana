"""Error-classification tests for the OpenCypher connector against a real Neo4j.

A mistranslated NL ask reaches the driver as invalid Cypher; the connector must
surface a ``QueryExecutionError`` carrying the vendor code and a coarse
``QueryErrorCategory`` so callers can pick user-facing copy without re-parsing
the raw message.
"""

import pytest

from invana.graph.connectors.base.exceptions import QueryErrorCategory, QueryExecutionError

pytestmark = pytest.mark.asyncio


async def test_invalid_cypher_is_classified_as_syntax(connector):
    # "show only 5" is the kind of NL fragment a weak model leaks into Cypher.
    with pytest.raises(QueryExecutionError) as exc_info:
        await connector.execute("show only 5")
    exc = exc_info.value
    assert exc.category == QueryErrorCategory.SYNTAX
    assert exc.code == "Neo.ClientError.Statement.SyntaxError"


async def test_valid_query_does_not_raise(connector):
    # Negative case: a well-formed query carries no error classification.
    result = await connector.execute("RETURN 1 AS n")
    assert result.metadata is not None
