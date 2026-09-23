"""The rule grammar, and how rules compose.

A rule matches an address and allows or denies it. Everything else it may carry
— excluded properties, a slice, what may leave — hangs off that one decision, so
there is one mechanism to learn instead of five shapes of rule
([GV4](docs/for-developers/modules/govern/spec.md)).

Three laws, and every one of them is here rather than spread across the
interpreter:

**Deny wins at any specificity** ([GV5]). A broad ``third_party/** deny`` is not
punchable by a narrow allow written later by someone who did not know the deny
existed. A rule that can be overridden by being more precise is not a bound.

**Allow intersects, deny accumulates, selectors intersect** ([GV6]) across the
agent, the plan and the Todo. Each contributor narrows; none widens.

**The default is the widest** ([GV7]). A lens that says nothing about a layer
permits that layer whole — except where it has explicitly *closed* the layer,
which is what picking four models out of six means ([GV23]).

[GV5]: docs/for-developers/modules/govern/spec.md
[GV6]: docs/for-developers/modules/govern/spec.md
[GV7]: docs/for-developers/modules/govern/spec.md
[GV23]: docs/for-developers/modules/govern/spec.md
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any

from invana.apps.govern.addressing import (
    GOVERNED_LAYERS,
    AddressError,
    Layer,
    matches,
    pattern_layer,
    validate_pattern,
)


class Role(enum.StrEnum):
    """What a plan's step is doing, and therefore how much the model matters.

    Four, fixed. A plan names a role and the cast resolves it
    ([GV10](docs/for-developers/modules/govern/spec.md)) — which stays true when
    the model line-up moves, in a way ``tier`` does not.
    """

    #: Prose in, structure out. It only reads, so it is the cheap one.
    extract = "extract"
    #: It writes the number a person will act on. The expensive one, deliberately.
    decide = "decide"
    #: Scores an output against a criterion. Often local — nothing should leave.
    judge = "judge"
    #: Text in, vector out. Whatever the index was built with.
    embed = "embed"


class EgressClass(enum.StrEnum):
    """What of the Graph's data may accompany a call across the boundary.

    A **closed** set, because an open one is a list nobody can audit: an
    auditor reading ``may_send`` has to know that what is not named cannot be
    sent, and that only holds if the vocabulary is fixed.
    """

    type_names = "type_names"
    property_names = "property_names"
    the_question = "the_question"
    property_values = "property_values"
    record_ids = "record_ids"
    aggregates = "aggregates"
    #: A local participant that never crosses a boundary at all.
    everything = "everything"


class Decision(enum.StrEnum):
    allowed = "allowed"
    denied = "denied"


#: Which layers accept which optional keys. A third party carries no selector
#: ([GV13](docs/for-developers/modules/govern/spec.md)): it is permitted or
#: denied, and ``egress`` governs the call. One you could slice is one you have
#: effectively modelled, and the answer to that is to bring it across as a model.
_SELECTABLE = (Layer.graph_data,)
_PROPERTY_BEARING = (Layer.graph_data,)
_OPTION_KEYS: dict[Layer, tuple[str, ...]] = {
    Layer.cache: ("max_age_s",),
    Layer.human: ("max_rounds",),
}


class RuleError(ValueError):
    """A rule the grammar refuses. The message names the part that is wrong."""


@dataclass(slots=True)
class Rule:
    """One statement about one set of participants."""

    match: str
    allow: bool
    #: ``{"exclude": ["revenue"]}`` — properties that **do not exist** in this
    #: world. Structural, not an instruction to a model.
    properties: dict[str, Any] = field(default_factory=dict)
    #: ``time`` · ``geo`` · ``dims``, composed into the query the connector runs.
    select: dict[str, Any] = field(default_factory=dict)
    #: ``{"may_send": [...]}`` — per destination, on the rule that matched it.
    egress: dict[str, Any] = field(default_factory=dict)
    #: Layer-specific limits that are not selectors — ``max_age_s`` on a cache
    #: rule, ``max_rounds`` on a human one ([GR10]).
    options: dict[str, Any] = field(default_factory=dict)

    @property
    def layer(self) -> Layer:
        return pattern_layer(self.match)

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"match": self.match, "allow": self.allow}
        for key in ("properties", "select", "egress", "options"):
            value = getattr(self, key)
            if value:
                out[key] = value
        return out

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Rule:
        if not isinstance(raw, dict):
            raise RuleError("A rule is an object with a match and an allow.")
        unknown = set(raw) - {"match", "allow", "properties", "select", "egress", "options"}
        if unknown:
            raise RuleError(f"A rule carries no {', '.join(sorted(unknown))}.")
        match = raw.get("match")
        if not isinstance(match, str) or not match.strip():
            raise RuleError("A rule needs a match.")
        allow = raw.get("allow")
        if not isinstance(allow, bool):
            raise RuleError(f"{match}: allow is true or false, and it is the one required field.")
        return cls(
            match=match.strip(),
            allow=allow,
            properties=dict(raw.get("properties") or {}),
            select=dict(raw.get("select") or {}),
            egress=dict(raw.get("egress") or {}),
            options=dict(raw.get("options") or {}),
        )


def validate_rule(rule: Rule) -> None:
    """Refuse a rule the grammar does not permit, naming the part that is wrong.

    Checked at **save**, never at run
    ([WO3](docs/for-developers/modules/govern/features/worlds.md)) — a rule that
    cannot legally run is one nobody should be able to store and then wonder
    about.
    """
    try:
        validate_pattern(rule.match)
    except AddressError as exc:
        raise RuleError(f"{rule.match}: {exc}") from None

    layer = rule.layer
    if layer not in GOVERNED_LAYERS:
        raise RuleError(f"{rule.match}: the agent layer is the spine, and the spine is not governed.")

    if rule.properties and layer not in _PROPERTY_BEARING:
        raise RuleError(f"{rule.match}: only graph data has properties to exclude.")
    if rule.properties:
        unknown = set(rule.properties) - {"exclude"}
        if unknown:
            raise RuleError(f"{rule.match}: properties carries exclude, not {', '.join(sorted(unknown))}.")
        if not isinstance(rule.properties.get("exclude", []), list):
            raise RuleError(f"{rule.match}: properties.exclude is a list of property names.")

    if rule.select and layer not in _SELECTABLE:
        raise RuleError(
            f"{rule.match}: a {layer.value} participant carries no selector — it is permitted or denied, "
            "and egress governs the call."
        )
    _validate_select(rule)

    if rule.egress:
        unknown = set(rule.egress) - {"may_send"}
        if unknown:
            raise RuleError(f"{rule.match}: egress carries may_send, not {', '.join(sorted(unknown))}.")
        for cls_ in rule.egress.get("may_send", []):
            try:
                EgressClass(cls_)
            except ValueError:
                raise RuleError(f"{rule.match}: {cls_!r} is not something that can be sent.") from None

    permitted_options = _OPTION_KEYS.get(layer, ())
    unknown_options = set(rule.options) - set(permitted_options)
    if unknown_options:
        named = ", ".join(sorted(unknown_options))
        if not permitted_options:
            raise RuleError(f"{rule.match}: a {layer.value} rule carries no options, and this one sets {named}.")
        raise RuleError(
            f"{rule.match}: a {layer.value} rule's options are {', '.join(permitted_options)}, not {named}."
        )


def _validate_select(rule: Rule) -> None:
    unknown = set(rule.select) - {"time", "geo", "dims"}
    if unknown:
        raise RuleError(f"{rule.match}: an axis is time, geo or dims — not {', '.join(sorted(unknown))}.")

    time = rule.select.get("time")
    if time is not None and (not isinstance(time, dict) or not (time.get("from") or time.get("to"))):
        raise RuleError(f"{rule.match}: a time slice needs a from, a to, or both.")
    geo = rule.select.get("geo")
    if geo is not None and (not isinstance(geo, dict) or not geo.get("in")):
        raise RuleError(f"{rule.match}: a geo slice needs the values it is in.")
    dims = rule.select.get("dims")
    if dims is not None and not isinstance(dims, dict):
        raise RuleError(f"{rule.match}: dims is a map of declared dimension to the values it is in.")


def validate_cast(cast: dict[str, Any]) -> None:
    """A cast is four known roles pointing at ``llm`` addresses, or at nothing."""
    for role, address in cast.items():
        try:
            Role(role)
        except ValueError:
            raise RuleError(f"{role!r} is not a role — a plan names extract, decide, judge or embed.") from None
        if address is None:
            continue
        if not isinstance(address, str) or not address.startswith(f"{Layer.llm.value}/"):
            raise RuleError(f"{role}: a cast resolves to an llm address, and {address!r} is not one.")


# ── the evaluation ───────────────────────────────────────────────────────────


@dataclass(slots=True)
class Verdict:
    """What one lens, or a composition of them, says about one address."""

    decision: Decision
    #: The pattern that decided it — so a refusal names its rule
    #: ([GR4](docs/for-developers/modules/govern/features/guardrails.md)) and
    #: never says *not permitted* with nothing to act on.
    rule_matched: str | None = None
    #: The world that refused, where **no rule did** — a closed layer admits only
    #: what it names, so nothing matched and ``rule_matched`` is empty
    #: ([GR15](docs/for-developers/modules/govern/features/guardrails.md)). The
    #: two are never both set: a rule that denied is the more specific answer.
    narrowed_by: str | None = None
    why: str | None = None
    #: The merged narrowing that applies, once the address is allowed.
    properties_excluded: list[str] = field(default_factory=list)
    select: dict[str, Any] = field(default_factory=dict)
    may_send: list[str] = field(default_factory=list)
    #: Whether any matching rule said anything about egress at all. ``[]`` with
    #: this ``False`` is *nobody wrote a rule about this crossing* and leaves it
    #: unbounded; ``[]`` with it ``True`` is *a rule reached it and permits
    #: nothing* ([GV30](docs/for-developers/modules/govern/spec.md)). The two are
    #: the same list and different runs, so the verdict keeps them apart.
    egress_stated: bool = False
    options: dict[str, Any] = field(default_factory=dict)

    @property
    def allowed(self) -> bool:
        return self.decision is Decision.allowed

    @property
    def egress_unbounded(self) -> bool:
        """Whether everything the caller holds may accompany this crossing.

        True where no matching rule mentioned egress at all, and where one named
        ``everything`` — a local participant that never leaves the deployment.
        """
        return not self.egress_stated or EgressClass.everything.value in self.may_send


@dataclass(frozen=True, slots=True)
class Closure:
    """One contributor's allow-list: the layers it closed, and what it named.

    [GV23](docs/for-developers/modules/govern/spec.md) says a layer in
    ``closed_layers`` admits only what **that lens's** rules allow. Composing
    contributors into one flat rule list loses the *that lens's* half, and the
    loss fails **open**: a Graph-wide ``llm/** allow`` would satisfy a world that
    allow-listed one local model, so *Nothing leaves* would leave. Keeping each
    contributor's closure whole is what makes allow **intersect**
    ([GV6](docs/for-developers/modules/govern/spec.md)) rather than union.
    """

    layers: frozenset[Layer] = frozenset()
    #: The patterns this contributor allowed, in the layers it closed.
    allows: tuple[str, ...] = ()
    #: The contributor's display name, frozen with the rest so a rename never
    #: rewrites what a past refusal said. This is what a closed-layer refusal
    #: names, because no rule fired and there is nothing else to point at
    #: ([GR15](docs/for-developers/modules/govern/features/guardrails.md)).
    name: str | None = None

    def admits(self, layer: Layer, address: str) -> bool:
        """Whether this closure lets ``address`` through. Silent about layers it
        did not close — a contributor that closed nothing narrows nothing here."""
        if layer not in self.layers:
            return True
        return any(matches(pattern, address) for pattern in self.allows)


@dataclass(slots=True)
class Effective:
    """A resolved, frozen lens — what a run is dispatched under.

    Computed once at run open and never recomputed mid-run
    ([GV8](docs/for-developers/modules/govern/spec.md)), which is what makes
    ``task_runs.lens_snapshot`` reconstructible rather than a pointer at rows
    that have since moved.
    """

    rules: list[Rule] = field(default_factory=list)
    cast: dict[str, str | None] = field(default_factory=dict)
    #: Layers this lens allow-lists: anything it does not name is out
    #: ([GV23](docs/for-developers/modules/govern/spec.md)). The **union** across
    #: contributors — any of them closing a layer closes it for all.
    closed_layers: set[Layer] = field(default_factory=set)
    #: One per contributor that closed something, kept apart so *its* rules are
    #: what its closure admits. See :class:`Closure`.
    closures: list[Closure] = field(default_factory=list)
    as_of: str | None = None
    #: ``[{id, kind, key, name, version}]`` — which lenses were composed, in
    #: order. ``name`` is carried as well as ``key`` because the run dashboard
    #: names the world a run *was* asked under, and a rename since must not
    #: change what a past run says about itself
    #: ([GR3](docs/for-developers/modules/govern/features/guardrails.md)).
    contributors: list[dict[str, Any]] = field(default_factory=list)

    def _closed_by(self, layer: Layer) -> str | None:
        """Which world closed ``layer``, for a refusal no rule made ([GR15]).

        More than one contributor can close the same layer, and naming one of
        several would say something the record does not support — so it is named
        only where the answer is unambiguous.
        """
        named = [c.name for c in self.closures if layer in c.layers and c.name]
        return named[0] if len(named) == 1 else None

    def decide(self, address: str) -> Verdict:
        """What this lens says about one participant."""
        layer = address.split("/", 1)[0]
        if layer == Layer.agent.value:
            return Verdict(decision=Decision.allowed, why="the spine is not governed")

        hits = [rule for rule in self.rules if matches(rule.match, address)]

        denials = [rule for rule in hits if not rule.allow]
        if denials:
            # Deny wins at any specificity, so the *broadest* denial is the one
            # worth naming: it is the bound a person has to argue with, and a
            # narrow one would read as an exception that could be edited away.
            rule = min(denials, key=lambda r: len(r.match))
            return Verdict(
                decision=Decision.denied,
                rule_matched=rule.match,
                why=f"denied by {rule.match}",
            )

        # Every closure has to admit it, before any allow is read: an allow-list
        # is not satisfied by somebody else's broader allow ([GV23] · [GV6]).
        for closure in self.closures:
            if not closure.admits(Layer(layer), address):
                return Verdict(
                    decision=Decision.denied,
                    narrowed_by=closure.name,
                    why=f"the {layer} layer is closed — nothing in it is in view unless this world names it",
                )

        allowances = [rule for rule in hits if rule.allow]
        if not allowances:
            if Layer(layer) in self.closed_layers:
                return Verdict(
                    decision=Decision.denied,
                    narrowed_by=self._closed_by(Layer(layer)),
                    why=f"the {layer} layer is closed — nothing in it is in view unless this world names it",
                )
            return Verdict(decision=Decision.allowed, why="not narrowed")

        return Verdict(
            decision=Decision.allowed,
            rule_matched=max(allowances, key=lambda r: len(r.match)).match,
            properties_excluded=_union_excluded(allowances),
            select=_intersect_selects(allowances),
            may_send=_intersect_may_send(allowances),
            egress_stated=any(rule.egress.get("may_send") is not None for rule in allowances),
            options=_tightest_options(allowances),
        )

    def resolve_cast(self, role: Role | str) -> str | None:
        return self.cast.get(Role(role).value)

    def as_snapshot(self) -> dict[str, Any]:
        """The document frozen onto the run — one object, not a composition."""
        return {
            "rules": [rule.as_dict() for rule in self.rules],
            "cast": dict(self.cast),
            "closed_layers": sorted(layer.value for layer in self.closed_layers),
            # Written as well as the union, because the union alone cannot say
            # *whose* allow-list a layer is, and a run has to be able to answer
            # that months later ([GV23]).
            "closures": [
                {"layers": sorted(layer.value for layer in c.layers), "allows": list(c.allows), "name": c.name}
                for c in self.closures
            ],
            "as_of": self.as_of,
            "contributors": list(self.contributors),
        }


def from_snapshot(snapshot: dict[str, Any] | None) -> Effective:
    """The document a run froze, read back as something that can decide.

    The inverse of :meth:`Effective.as_snapshot`, and it lives beside it so the
    two cannot drift: what the interpreter dispatches under, what the run
    dashboard reads back and what an auditor is shown are one parse of one
    document.

    A run opened before Govern shipped carries no snapshot, and the widest state
    is the honest reading of that — it ran under no narrowing because there was
    none to run under ([GV7](docs/for-developers/modules/govern/spec.md)).
    """
    if not snapshot:
        return Effective()
    rules = [Rule.from_dict(raw) for raw in (snapshot.get("rules") or [])]
    closed = {Layer(value) for value in (snapshot.get("closed_layers") or [])}
    raw_closures = snapshot.get("closures")
    if raw_closures is None:
        # A snapshot written before closures were carried. Reading its flat rule
        # list as one closure is the nearest true thing: it is what that run was
        # actually dispatched under, and re-deciding it some other way now would
        # rewrite what a past answer rested on ([GR3]).
        allows = tuple(rule.match for rule in rules if rule.allow)
        # One contributor is the only case where the closure's owner is knowable
        # from a snapshot that did not record it; more than one and a refusal
        # names the world it ran under rather than guessing which closed it.
        named = snapshot.get("contributors") or []
        legacy_name = str(named[0].get("name")) if len(named) == 1 and named[0].get("name") else None
        closures = [Closure(layers=frozenset(closed), allows=allows, name=legacy_name)] if closed else []
    else:
        closures = [
            Closure(
                layers=frozenset(Layer(v) for v in (c.get("layers") or [])),
                allows=tuple(c.get("allows") or []),
                name=c.get("name"),
            )
            for c in raw_closures
        ]
    return Effective(
        rules=rules,
        cast=dict(snapshot.get("cast") or {}),
        closed_layers=closed,
        closures=closures,
        as_of=snapshot.get("as_of"),
        contributors=list(snapshot.get("contributors") or []),
    )


def _union_excluded(rules: list[Rule]) -> list[str]:
    """Exclusions **accumulate**: a property any contributor removed is gone.

    The mirror of deny-winning, one grain down. If they intersected, adding a
    narrower rule could bring a property back into view, which is widening.
    """
    out: set[str] = set()
    for rule in rules:
        out.update(rule.properties.get("exclude", []))
    return sorted(out)


def _intersect_selects(rules: list[Rule]) -> dict[str, Any]:
    """Selectors **intersect** — the slice is the overlap, never the union."""
    selects = [rule.select for rule in rules if rule.select]
    if not selects:
        return {}

    out: dict[str, Any] = {}

    times = [s["time"] for s in selects if s.get("time")]
    if times:
        froms = [t["from"] for t in times if t.get("from")]
        tos = [t["to"] for t in times if t.get("to")]
        axes = {t["axis"] for t in times if t.get("axis")}
        time: dict[str, Any] = {}
        if axes:
            time["axis"] = sorted(axes)[0]
        if froms:
            time["from"] = max(froms)
        if tos:
            time["to"] = min(tos)
        out["time"] = time

    geos = [s["geo"] for s in selects if s.get("geo")]
    if geos:
        values: set[str] | None = None
        for geo in geos:
            here = set(geo.get("in", []))
            values = here if values is None else values & here
        geo_out: dict[str, Any] = {"in": sorted(values or ())}
        axes = {g["axis"] for g in geos if g.get("axis")}
        if axes:
            geo_out["axis"] = sorted(axes)[0]
        vocabs = {g["vocab"] for g in geos if g.get("vocab")}
        if vocabs:
            geo_out["vocab"] = sorted(vocabs)[0]
        out["geo"] = geo_out

    dims_sets = [s["dims"] for s in selects if s.get("dims")]
    if dims_sets:
        dims: dict[str, list[str]] = {}
        for entry in dims_sets:
            for name, values_in in entry.items():
                current = dims.get(name)
                incoming = set(values_in)
                dims[name] = sorted(incoming if current is None else set(current) & incoming)
        out["dims"] = dims

    return out


def _intersect_may_send(rules: list[Rule]) -> list[str]:
    """Egress **intersects**: what may leave is what every matching rule permits.

    An unmatched crossing sends nothing — the default is ``[]``
    ([GV12](docs/for-developers/modules/govern/spec.md)) — and that default is
    the caller's to apply, because *no rule matched* and *a rule matched and
    permitted nothing* are the same outcome and different stories.
    """
    stated = [rule.egress["may_send"] for rule in rules if rule.egress.get("may_send") is not None]
    if not stated:
        return []
    if any(EgressClass.everything.value in classes for classes in stated) and len(stated) == 1:
        return [EgressClass.everything.value]

    permitted: set[str] | None = None
    for classes in stated:
        here = set(classes)
        if EgressClass.everything.value in here:
            continue
        permitted = here if permitted is None else permitted & here
    return sorted(permitted) if permitted is not None else [EgressClass.everything.value]


def _tightest_options(rules: list[Rule]) -> dict[str, Any]:
    """The smallest number wins — every option here is a ceiling."""
    out: dict[str, Any] = {}
    for rule in rules:
        for key, value in rule.options.items():
            out[key] = value if key not in out else min(out[key], value)
    return out


def compose(contributors: list[Effective]) -> Effective:
    """``effective = agent ∩ plan ∩ todo`` — computed once, then frozen.

    Rules from every contributor go into one list, which is what makes deny
    accumulate and allow intersect at the same time: a denial anywhere in the
    list wins, and an allow-list closed by any contributor stays closed for all
    of them. The **cast does not intersect** — two model addresses have no
    common narrowing — so innermost simply wins
    ([GV6](docs/for-developers/modules/govern/spec.md)).
    """
    out = Effective()
    for contributor in contributors:
        out.rules.extend(contributor.rules)
        out.closed_layers |= contributor.closed_layers
        out.closures.extend(contributor.closures)
        out.contributors.extend(contributor.contributors)
        # Innermost wins: later contributors are nearer the run, and a role
        # nobody set stays unset rather than falling back to an outer one's.
        for role, address in contributor.cast.items():
            if address is not None:
                out.cast[role] = address
        if contributor.as_of is not None:
            out.as_of = contributor.as_of
    return out
