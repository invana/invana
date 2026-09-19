"""The lens, as the connector sees it
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md).

A **lens** bounds what a run may see, use and send across five layers
(docs/for-developers/modules/govern/spec.md). Only one of those layers reaches a
graph database, and only part of that layer survives the trip: a connector does
not know about addresses, worlds, guardrails or `graph_data/model/Observations@v2`.
It is handed its own vocabulary — a **type**, the properties that type declares,
the ones this world does not carry, and a structured predicate over the rest
(CC6).

Three grains, and this module enforces two of them
(docs/for-developers/orchestration.md § 0.9):

===============  ==========================  ==================================
Grain            Removes                     Enforced by
===============  ==========================  ==================================
type             a model, a type, a rel.     ``allowed_types`` — the validator
property         one property of a type      ``TypeBound.excluded`` — rejection
                                             **plus** the projection rewrite
records          rows                        ``TypeBound.predicates`` — composed
                                             into the query that executes
===============  ==========================  ==================================

**Nothing here is honoured by filtering afterwards** (CN8). Rows that come back
and are dropped leave the counts, the aggregates and the schema the generating
model saw all outside the bound — a display filter wearing a bound's name.
"""

from __future__ import annotations

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from invana.graph.types.filters import FilterGroup


def query_digest(query: str) -> str:
    """The short content digest a trace carries for a query.

    Same shape as every other digest on the record — ``sha256:`` and the first
    twelve hex characters, enough to tell two queries apart in a trace without
    putting either of them in it.
    """
    return "sha256:" + hashlib.sha256(query.encode()).hexdigest()[:12]


@dataclass(frozen=True)
class TypeBound:
    """What one world says about one type.

    ``declared`` is the model version's whole property set and ``excluded`` the
    part this world does not carry; ``permitted`` is what a rewritten projection
    enumerates. A type that excludes something and declares nothing cannot be
    projected and is refused rather than projected to the empty map (CC11).
    """

    type_name: str
    declared: frozenset[str] = frozenset()
    excluded: frozenset[str] = frozenset()
    predicates: FilterGroup | None = None

    @property
    def permitted(self) -> tuple[str, ...]:
        """``declared - excluded``, in a stable order so a rewrite is deterministic."""
        return tuple(sorted(self.declared - self.excluded))

    @property
    def narrows_structure(self) -> bool:
        """Whether a whole-element return of this type has to be rewritten."""
        return bool(self.excluded)

    @property
    def narrows_records(self) -> bool:
        """Whether a predicate has to be composed into the query for this type."""
        return bool(self.predicates and self.predicates.conditions)

    @property
    def is_projectable(self) -> bool:
        """Whether ``permitted`` can be enumerated — false when nothing was declared."""
        return bool(self.declared)


@dataclass(frozen=True)
class QueryLens:
    """The part of a lens a connector can enforce.

    ``allowed_types`` of ``None`` means every type this graph holds — the widest,
    which is the default a Graph that never set a lens gets (GV7). An empty
    ``QueryLens`` narrows nothing and is skipped entirely, so an ungoverned query
    executes byte-identical.
    """

    bounds: Mapping[str, TypeBound] = field(default_factory=dict)
    allowed_types: frozenset[str] | None = None

    def bound_for(self, type_name: str) -> TypeBound | None:
        return self.bounds.get(type_name)

    def allows_type(self, type_name: str) -> bool:
        return self.allowed_types is None or type_name in self.allowed_types

    @property
    def is_empty(self) -> bool:
        """Nothing to enforce — no denied types and no bound that narrows anything."""
        if self.allowed_types is not None:
            return False
        return not any(b.narrows_structure or b.narrows_records for b in self.bounds.values())


@dataclass(frozen=True)
class ComposedQuery:
    """What the compiler produced, and what the trace records (CC14).

    Both queries ride back so *the generated query, exactly as executed* stays
    true by showing both and saying which ran. Equal digests mean the lens
    changed nothing.
    """

    generated: str
    executed: str
    parameters: dict[str, Any] = field(default_factory=dict)
    projected: tuple[str, ...] = ()
    composed: tuple[str, ...] = ()

    @property
    def rewritten(self) -> bool:
        return self.generated != self.executed

    @property
    def digests(self) -> dict[str, str]:
        """``{"generated": …, "executed": …}`` — the trace reads these as
        ``query.generated`` and ``query.executed``."""
        return {"generated": query_digest(self.generated), "executed": query_digest(self.executed)}

    @classmethod
    def unchanged(cls, query: str, parameters: dict[str, Any] | None = None) -> ComposedQuery:
        """The ungoverned case — one query, two equal digests."""
        return cls(generated=query, executed=query, parameters=dict(parameters or {}))
