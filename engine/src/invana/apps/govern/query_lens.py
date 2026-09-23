"""The lens as the connector sees it — one translation, in one place.

A connector knows nothing of addresses, worlds, guardrails or layers. It is
handed the types it may read, the properties each one keeps, and a predicate
over the rest
([the connector contract](docs/for-developers/modules/graph-connectors/features/the-connector-contract.md)).
This module is the only place that turns the one into the other
([GV32](docs/for-developers/modules/govern/spec.md)).

It lives in ``apps.govern`` because it needs both halves and neither of the
other two homes works: in the connector, every integration would reimplement the
grammar and each would be a place enforcement could fail **open**; in the
runtime, the grammar would sit two bands from the rules it implements.

Two of the three grains of [govern § 2](docs/for-developers/modules/govern/spec.md)
are carried out here — **property**, as the exclusion a projection is rewritten
to, and **records**, as the predicate composed into the query. The third,
**type**, is the allow-list. Nothing is a filter over what came back.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from invana.apps.govern.addressing import Layer
from invana.apps.govern.rules import Effective, Verdict
from invana.apps.modeller.models import GraphVersion
from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup
from invana.graph.types.lens import QueryLens, TypeBound


def model_address(*, model_name: str, version_label: str | None) -> str:
    """``graph_data/model/AirRoutes@1.0.1`` — the one identifier for a version.

    Built here as well as in the catalogue's listing so a run is checked at
    exactly the string a rule was written against; a second spelling of an
    address is a second participant ([GV4]).
    """
    label = f"{model_name}@{version_label}" if version_label else model_name
    return f"{Layer.graph_data.value}/model/{label}"


@dataclass(frozen=True, slots=True)
class ModelBinding:
    """One published version a rule can name — its address, its types, its axes.

    A Graph's runs are grounded on the introspected ``global`` model, because it
    is the one model whose types cover everything an arbitrary query can reach.
    The authored models layered on top of it are still addressable, and
    [GV33](docs/for-developers/modules/govern/spec.md) is what makes them
    **bindable**: a rule naming ``Deals@*`` narrows the types ``Deals`` declares,
    and slices them along *that* version's axes rather than the mirror's.
    """

    address: str
    #: Node and edge types together — the connector bounds both.
    types: tuple[str, ...] = ()
    axes: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class _Governed:
    """What ended up governing one type, and along which model's axes."""

    verdict: Verdict
    axes: dict[str, Any]
    #: The model addresses whose rules reached this type — recorded on the touch
    #: so a run can say what bound it without the snapshot copying the schema.
    named_by: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class CompiledLens:
    """The connector's lens, plus what Govern has to record about compiling it.

    The connector is handed ``query_lens`` and nothing else — it knows nothing of
    worlds, and ``TypeBound.predicates`` is the slice in its own vocabulary. But
    the touch is read by a **person**, who authored `time` · `geo` · `dims` and
    needs to see those words back ([WO17](docs/for-developers/modules/govern/features/worlds.md)),
    so the authored shape rides here rather than being pushed down into the
    connector's types where nothing would read it.
    """

    query_lens: QueryLens
    #: ``{type_name: {"time": …, "geo": …}}`` — the authored slice per type, for
    #: the types that carry one. A type nobody sliced is absent, never ``{}``.
    selects: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
    #: ``{type_name: [property, …]}`` — what the projection was rewritten to
    #: leave out, per type. Keyed the same way and for the same reason.
    excluded: Mapping[str, tuple[str, ...]] = field(default_factory=dict)


def build_query_lens(
    effective: Effective,
    *,
    version: GraphVersion,
    verdict: Verdict,
    bindings: Sequence[ModelBinding] = (),
) -> QueryLens:
    """:func:`compile_lens`, for a caller that only wants the connector's half."""
    return compile_lens(effective, version=version, verdict=verdict, bindings=bindings).query_lens


def compile_lens(
    effective: Effective,
    *,
    version: GraphVersion,
    verdict: Verdict,
    bindings: Sequence[ModelBinding] = (),
) -> CompiledLens:
    """What this lens lets a query on ``version`` read.

    ``verdict`` is the decision already taken about the grounding version's own
    address, so the check and the compilation cannot disagree about which rules
    matched. ``bindings`` are the **other** published versions of this Graph:
    a rule naming one of them bounds the types it declares
    ([GV33](docs/for-developers/modules/govern/spec.md)), which is what makes an
    authored model a bound and not only something the picker offers.

    **A lens that narrows nothing returns an empty one**, and the query then
    executes byte-identical ([GV7]). That is not an optimisation: a rewritten
    query on an ungoverned Graph would change what every existing run does, and
    *nothing was narrowed* has to be visible as two equal digests.
    """
    declared = _declared_properties(version)
    governed = resolve_types(effective, declared=tuple(declared), verdict=verdict, version=version, bindings=bindings)

    closed = Layer.graph_data in effective.closed_layers
    narrows = closed or any(g.verdict.properties_excluded or g.verdict.select for g in governed.values())
    if not narrows:
        return CompiledLens(query_lens=QueryLens())

    bounds = {}
    for type_name, properties in declared.items():
        here = governed[type_name]
        excluded = frozenset(here.verdict.properties_excluded) & frozenset(properties)
        slices = _predicates(here.verdict.select, axes=here.axes)
        bounds[type_name] = TypeBound(
            type_name=type_name,
            declared=frozenset(properties),
            excluded=excluded,
            # A type that does not carry the axis is not *on* the axis, so it is
            # left unsliced rather than predicated on a property it lacks — which
            # would return nothing and read as an empty world.
            predicates=_group([c for prop, c in slices if prop in properties]),
        )

    # Closing `graph_data` is what picking four models out of six means ([GV23]):
    # only what the lens names is in view. A type is in view when whatever
    # governs it allows it — the model that named it, or the grounding version
    # itself where no rule reached the type at all ([GV33]).
    allowed = frozenset(name for name, g in governed.items() if g.verdict.allowed) if closed else None
    return CompiledLens(
        query_lens=QueryLens(bounds=bounds, allowed_types=allowed),
        # Read off the same ``governed`` the bounds were built from, so what the
        # touch says was applied and what the connector was handed cannot drift.
        selects={name: dict(b.verdict.select) for name, b in governed.items() if b.verdict.select},
        excluded={name: tuple(sorted(b.excluded)) for name, b in bounds.items() if b.excluded},
    )


def resolve_types(
    effective: Effective,
    *,
    declared: Sequence[str],
    verdict: Verdict,
    version: GraphVersion,
    bindings: Sequence[ModelBinding] = (),
) -> dict[str, _Governed]:
    """Which rule governs each type of the grounding version, and along whose axes.

    A run is grounded on the introspected mirror, so every type it can reach is
    one of *its* types. A rule that named an authored model reaches the types
    **that** model declares, and brings that model's axes with it — the mirror
    declares none, so a slice resolved against it would compile to nothing and
    read as *nobody narrowed it* ([GV33] · [GV14]).

    ``bindings`` must not include the grounding version itself: it is already
    the fallback, and reading it twice would let its own *not narrowed* verdict
    widen a bound some other model named.
    """
    fallback = _Governed(verdict=verdict, axes=version.axes or {})
    out: dict[str, _Governed] = dict.fromkeys(declared, fallback)

    for binding in bindings:
        decided = effective.decide(binding.address)
        if decided.allowed and decided.rule_matched is None:
            # No rule reached this model, so it says nothing about its types.
            # A denial with no rule is a closed layer speaking, and that is the
            # grounding verdict's business rather than this model's.
            continue
        for type_name in binding.types:
            current = out.get(type_name)
            if current is None:
                # A type the authored model declares and the mirror does not.
                # The run cannot reach it, so there is nothing here to bound.
                continue
            out[type_name] = _first(decided, binding) if current is fallback else _merge(current, decided, binding)
    return out


def _first(decided: Verdict, binding: ModelBinding) -> _Governed:
    return _Governed(verdict=decided, axes=binding.axes or {}, named_by=(binding.address,))


def _merge(current: _Governed, decided: Verdict, binding: ModelBinding) -> _Governed:
    """Two models declaring one type — narrowing accumulates, and deny wins.

    The same reading [GV5](docs/for-developers/modules/govern/spec.md) and
    [GV6](docs/for-developers/modules/govern/spec.md) already give a rule list.
    Picking a winner between two bounds is the one resolution that could widen,
    so there is no precedence here: the exclusions union, the selects merge, and
    a denial on either side denies the type.
    """
    kept = current.verdict
    if not decided.allowed:
        winner = decided
    elif not kept.allowed:
        winner = kept
    else:
        winner = Verdict(
            decision=kept.decision,
            rule_matched=kept.rule_matched or decided.rule_matched,
            why=kept.why,
            properties_excluded=sorted({*kept.properties_excluded, *decided.properties_excluded}),
            select={**decided.select, **kept.select},
            may_send=kept.may_send,
            egress_stated=kept.egress_stated,
            options=kept.options,
        )
    return _Governed(
        verdict=winner,
        # The axes already in hand win: a type reached by two models keeps the
        # first model's declaration rather than having it silently replaced.
        axes={**(binding.axes or {}), **current.axes},
        named_by=(*current.named_by, binding.address),
    )


def _declared_properties(version: GraphVersion) -> dict[str, tuple[str, ...]]:
    """Every node and edge type of this version, with the properties it maps.

    Relationships are bound like node types because a connector narrows both —
    an excluded property on an edge is as absent from this world as one on a
    node, and a lens that reached only nodes would be a bound with a hole in it.
    """
    out: dict[str, tuple[str, ...]] = {}
    for definition in (*version.node_types, *version.edge_types):
        out[definition.name] = tuple(
            mapping.property_key.name for mapping in definition.property_mappings if mapping.property_key is not None
        )
    return out


def _predicates(select: dict[str, Any], *, axes: dict[str, Any]) -> list[tuple[str, FilterExpression]]:
    """The slice, as conditions on the properties the **model** declared.

    The model states which property carries valid time and which carries
    geography ([DM6](docs/for-developers/modules/connect-and-model/features/domain-models.md)),
    so that declaration is what a slice compiles against. A rule restating the
    axis is read as documentation, never as a second source of truth — a slice
    that could name its own property would be a query, and the product has one
    place to write a query ([GV14]).

    An axis the version never declared yields nothing: it is refused at save
    ([validate.py]), and a lens written before the model lost the axis must
    narrow nothing rather than narrow something else.
    """
    out: list[tuple[str, FilterExpression]] = []

    time = select.get("time") or {}
    time_property = (axes.get("time") or {}).get("property")
    if time_property:
        if time.get("from"):
            out.append((time_property, FilterExpression(property=time_property, op=FilterOp.GTE, value=time["from"])))
        if time.get("to"):
            out.append((time_property, FilterExpression(property=time_property, op=FilterOp.LTE, value=time["to"])))

    geo = select.get("geo") or {}
    geo_property = (axes.get("geo") or {}).get("property")
    if geo_property and geo.get("in"):
        out.append((geo_property, FilterExpression(property=geo_property, op=FilterOp.IN, value=list(geo["in"]))))

    declared_dims = set(axes.get("dims") or ())
    for name, values in (select.get("dims") or {}).items():
        if name in declared_dims and values:
            out.append((name, FilterExpression(property=name, op=FilterOp.IN, value=list(values))))

    return out


def _group(conditions: list[FilterExpression]) -> FilterGroup | None:
    """The conditions as one ``AND`` group — a slice is an intersection ([GV6])."""
    return FilterGroup(conditions=list(conditions)) if conditions else None
