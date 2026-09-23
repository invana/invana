"""Validating a lens — **at save, never at run**.

A world that cannot legally run is one nobody should be able to store and then
wonder about ([WO3](docs/for-developers/modules/govern/features/worlds.md)), so
every check here happens while somebody is still looking at the form.

Three refusals, and each names the bound rather than saying *not permitted*:

1. **A world cannot widen a guardrail.** Allowing something a guardrail denies
   is refused naming the guardrail's rule. Deny wins at any specificity
   ([GV5]) — a narrower allow does not punch through a broader deny, or the
   bound would not be one.
2. **Only declared axes are selectable.** Slicing a model that declared no such
   axis is refused naming the model *and* the axis, never silently ignored
   ([GV14]). Declaring one is a modelling act, in the model editor.
3. **A rule must name something.** A pattern matching nothing in the Graph is
   almost always a typo, and a bound over nothing is a bound nobody will notice
   is missing. This one **warns** rather than refuses — a rule written ahead of
   the model it will govern is legitimate.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from invana.apps.govern.addressing import Layer, matches
from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.rules import Decision, Effective, Rule, RuleError, validate_cast, validate_rule


@dataclass(frozen=True, slots=True)
class Refusal:
    """One reason a lens may not be saved, with the thing to act on."""

    #: ``widens_guardrail`` · ``undeclared_axis`` · ``grammar``
    code: str
    #: The rule in the draft that caused it.
    rule: str
    #: One sentence naming the bound.
    message: str
    #: What the person can open to fix it — a guardrail's rule, a model version.
    recourse: str | None = None


@dataclass(frozen=True, slots=True)
class Warning_:
    code: str
    rule: str
    message: str


@dataclass(slots=True)
class Validation:
    refusals: list[Refusal] = field(default_factory=list)
    warnings: list[Warning_] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.refusals


def validate_draft(
    *,
    rules: list[Rule],
    cast: dict[str, str | None],
    closed_layers: set[Layer],
    guardrails: Effective,
    catalogue: Catalogue,
) -> Validation:
    """Check a world against the guardrails it must live inside, and the Graph.

    ``guardrails`` is the *composed* effective guardrail — Graph-scoped plus any
    pinned on the agent — so a world is checked against the same object a run
    would be dispatched under, rather than against a list somebody reassembles.
    """
    out = Validation()

    for rule in rules:
        try:
            validate_rule(rule)
        except RuleError as exc:
            out.refusals.append(Refusal(code="grammar", rule=rule.match, message=str(exc)))
            continue

        _check_does_not_widen(rule, guardrails, out)
        _check_declared_axes(rule, catalogue, out)
        _check_matches_something(rule, catalogue, out)

    try:
        validate_cast(cast)
    except RuleError as exc:
        out.refusals.append(Refusal(code="grammar", rule="cast", message=str(exc)))
    else:
        _check_cast_against(cast, guardrails, out)

    for layer in closed_layers:
        if layer not in catalogue.layers_present():
            out.warnings.append(
                Warning_(
                    code="closes_empty_layer",
                    rule=layer.value,
                    message=f"Nothing is configured in {layer.value}, so closing it narrows nothing yet.",
                )
            )

    return out


def _check_does_not_widen(rule: Rule, guardrails: Effective, out: Validation) -> None:
    """An allow is refused where a guardrail denies what it would reach."""
    if not rule.allow:
        # A deny never widens anything. It is always legal, whatever the
        # guardrails say — narrowing is the one direction that is always open.
        return

    for guardrail_rule in guardrails.rules:
        if guardrail_rule.allow:
            continue
        # The world's allow widens the guardrail if the two patterns overlap at
        # all: either the guardrail covers everything the allow reaches, or the
        # allow reaches inside the guardrail's denial.
        if _patterns_overlap(rule.match, guardrail_rule.match):
            out.refusals.append(
                Refusal(
                    code="widens_guardrail",
                    rule=rule.match,
                    message=(
                        f"Allowing {rule.match} is refused: the guardrail {guardrail_rule.match} denies it. "
                        "Deny wins at any specificity."
                    ),
                    recourse=guardrail_rule.match,
                )
            )
            return


def _patterns_overlap(a: str, b: str) -> bool:
    """Could one participant satisfy both patterns?

    Wildcards make this a containment test in both directions rather than a
    string comparison: ``third_party/**`` and
    ``third_party/api/clearbit.com/**`` overlap, and neither is a prefix of the
    other as text.
    """
    return matches(a, _concretise(b)) or matches(b, _concretise(a))


def _concretise(pattern: str) -> str:
    """A pattern as the most ordinary address it could name.

    ``*`` and ``**`` both become one placeholder segment, and a ``*`` inside a
    segment becomes a placeholder run — enough for an overlap test, because two
    patterns that can agree on this witness can agree on a real participant too.
    """
    parts = [("x" if segment in ("*", "**") else segment.replace("*", "x")) for segment in pattern.split("/")]
    return "/".join(parts)


def _check_declared_axes(rule: Rule, catalogue: Catalogue, out: Validation) -> None:
    """Refuse a slice along an axis the model never declared, naming both."""
    if not rule.select:
        return

    targets = [p for p in catalogue.matching(rule.match) if p.layer is Layer.graph_data]
    for participant in targets:
        declared = participant.axes or {}
        for axis in rule.select:
            if axis == "dims":
                requested = set(rule.select["dims"] or {})
                available = set(declared.get("dims") or ())
                missing = sorted(requested - available)
                if missing:
                    out.refusals.append(
                        Refusal(
                            code="undeclared_axis",
                            rule=rule.match,
                            message=(
                                f"{participant.label} declares no dimension {', '.join(missing)}. "
                                "Declaring one is a modelling act, in the model editor."
                            ),
                            recourse=participant.address,
                        )
                    )
                continue
            if not declared.get(axis):
                out.refusals.append(
                    Refusal(
                        code="undeclared_axis",
                        rule=rule.match,
                        message=(
                            f"{participant.label} declares no {axis} axis, so it cannot be sliced by one. "
                            "Declaring one is a modelling act, in the model editor."
                        ),
                        recourse=participant.address,
                    )
                )


def _check_matches_something(rule: Rule, catalogue: Catalogue, out: Validation) -> None:
    if catalogue.matching(rule.match):
        return
    out.warnings.append(
        Warning_(
            code="matches_nothing",
            rule=rule.match,
            message=f"Nothing in this Graph matches {rule.match} right now.",
        )
    )


def _check_cast_against(cast: dict[str, str | None], guardrails: Effective, out: Validation) -> None:
    """A cast picks *within* the rules; it does not widen them.

    Caught here so the refusal lands while somebody is authoring, rather than
    when a run tries to open under it and finds the model denied.
    """
    for role, address in cast.items():
        if address is None:
            continue
        verdict = guardrails.decide(address)
        if verdict.decision is Decision.denied:
            out.refusals.append(
                Refusal(
                    code="cast_denied",
                    rule=f"cast.{role}",
                    message=(
                        f"{role} casts to {address}, which {verdict.rule_matched or 'a guardrail'} denies. "
                        "A cast is a resolution, not a bound."
                    ),
                    recourse=verdict.rule_matched,
                )
            )
