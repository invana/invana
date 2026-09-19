"""Memgraph connector — the language connector, with its identity function.

Memgraph is the module spec's own example of why a language connector is
complete rather than abstract: it rides the Bolt driver and overrides almost
nothing (docs/for-developers/modules/graph-connectors/spec.md § 3). *Almost*
is the word that matters — it has no ``elementId()``, and its ``id()`` returns
an integer.

Both halves are needed. Naming the function alone leaves ``id(n) = "428"``,
which Memgraph does not reject — it simply matches nothing, and a read that
returns no rows because of a type mismatch is indistinguishable from a record
that is not there.
"""

from __future__ import annotations

from typing import Any, ClassVar

from invana.graph.connectors.base.exceptions import QueryErrorCategory
from invana.graph.connectors.cypher.connector import CYPHER_PROFILE, OpenCypherConnector
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder
from invana.graph.types.capabilities import Version

from invana_memgraph.query_builder import MemgraphQueryBuilder

# Memgraph reports its own version through ``SHOW VERSION``, which the openCypher
# connector already falls back to when ``dbms.components()`` is absent.
MEMGRAPH_PROFILE = CYPHER_PROFILE.merge(
    min_version=Version(2, 0),
    tested_max=Version(3, 6),
)


class MemgraphConnector(OpenCypherConnector):
    """openCypher over Bolt, addressing elements the way Memgraph does."""

    _capability_profile = MEMGRAPH_PROFILE
    query_builder: ClassVar[type[OpenCypherQueryBuilder]] = MemgraphQueryBuilder

    def classify_error(self, code: str | None, message: str) -> str:
        """Memgraph returns one code for everything, so the message is what carries it.

        Every failure arrives as ``Memgraph.ClientError.MemgraphError.MemgraphError``
        — the code cannot tell a mistranslation from a timeout. What it does say is
        in the prose: a parse failure names itself.
        """
        low = message.lower()
        if "parsing error" in low or "syntax" in low:
            return QueryErrorCategory.SYNTAX
        if "timeout" in low or "timed out" in low:
            return QueryErrorCategory.TIMEOUT
        return super().classify_error(code, message)

    def coerce_id(self, id_value: str) -> Any:
        """A string id back to the integer ``id()`` compares against.

        Anything that is not a number is passed through untouched rather than
        forced — a value this connector cannot place is better refused by the
        database than silently turned into one that matches nothing.
        """
        text = str(id_value)
        return int(text) if text.lstrip("-").isdigit() else id_value
