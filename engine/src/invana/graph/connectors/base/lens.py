"""The lens seam — one compiler per query language
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md).

A lens is compiled **per language, never per vendor** (CC9), so it lives beside
the query builder in ``cypher/`` and ``gremlin/`` and an integration inherits
enforcement without writing a line of it — the same rule that already holds for
reading, writing and schema (CN1).

Compose, project and reject are **one pass** (CC7). All three need the same
reading of the query — which variable is bound to which type — and three passes
would read it three ways and disagree on the third.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.types.lens import ComposedQuery, QueryLens


class LensCompiler(ABC):
    """Turns a query plus a :class:`QueryLens` into the query that executes."""

    @abstractmethod
    def compile(
        self,
        query: str,
        parameters: dict[str, Any] | None,
        lens: QueryLens,
    ) -> ComposedQuery:
        """Compose the predicate, rewrite the projection, reject the excluded.

        Raises :class:`~invana.graph.connectors.base.exceptions.LensViolationError`
        — before the wire — when the query names something this world does not
        hold, or has a shape the compiler cannot bound (CC10).
        """


class UnsupportedLensCompiler(LensCompiler):
    """A language with no governed path — every query under a lens is refused.

    This is CN6 doing its job: unsupported is **declared**, not discovered. The
    alternative is a lens that silently enforces nothing, which is the one
    outcome a bound may not have.
    """

    language: str = "this query language"

    def compile(
        self,
        query: str,
        parameters: dict[str, Any] | None,
        lens: QueryLens,
    ) -> ComposedQuery:
        if lens.is_empty:
            return ComposedQuery.unchanged(query, parameters)
        raise LensViolationError(
            f"A lens cannot be enforced on {self.language} — run this graph's questions "
            "against a connection whose language composes one, or remove the lens.",
            code="lens_not_supported",
        )
