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
from collections.abc import Iterable, Iterator
from typing import Any

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.types.filters import FilterExpression, FilterGroup
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


# ── a structured reader, bounded by construction (CC22) ─────────────────────────


def filter_properties(group: FilterGroup | None) -> Iterator[str]:
    """Every property a filter tree names, however deep."""
    if group is None:
        return
    for condition in group.conditions:
        if isinstance(condition, FilterGroup):
            yield from filter_properties(condition)
        elif isinstance(condition, FilterExpression):
            yield condition.property


def admit_structured(
    lens: QueryLens | None,
    *,
    types: Iterable[str | None] = (),
    properties: Iterable[str] = (),
) -> QueryLens | None:
    """Check what a structured read names against *lens*, before it is built.

    A reader that writes its own query has no text to compile, so the refusals a
    compiler makes are made here, once, for every language (CC22): a type the
    request names that this world does not hold, a property it filters or sorts
    on that this world does not carry, and a type that excludes properties but
    declares none to project to. What passes is composed into the traversal by
    the language's builder — nothing is filtered afterwards.

    Returns ``None`` when there is nothing to enforce, so an ungoverned read
    builds exactly the query it built before.
    """
    if lens is None or lens.is_empty:
        return None
    for name in types:
        if name and not lens.allows_type(name):
            raise LensViolationError(
                f"This world has no {name}.", code="lens_type_denied", type_name=name, fragment=name
            )
    for prop in properties:
        for bound in lens.bounds.values():
            if prop in bound.excluded:
                raise LensViolationError(
                    f"This world does not carry {bound.type_name}.{prop}.",
                    code="lens_property_excluded",
                    type_name=bound.type_name,
                    property_name=prop,
                )
    for bound in lens.bounds.values():
        if bound.narrows_structure and not bound.is_projectable:
            raise LensViolationError(
                f"{bound.type_name} excludes properties but declares none, so there is nothing to return.",
                code="lens_unprojectable",
                type_name=bound.type_name,
            )
    return lens
