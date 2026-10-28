"""A Graph's guardrail as one property rule, and what it compiles to.

*When a run touches* ``Deal.price`` · *it may* read it, read it in counts only,
or never read it · *and the result* may leave or stays in the Graph. Nothing
else — so an auditor reads one line per protected property.

The rule is what a modeller authors; ``rules`` is **derived** from it at save
and stored beside it, so enforcement, ``lens_snapshot`` and the touch record
keep the one path every other lens takes:

==============  ============================================================
``never``       ``graph_data/model/**`` allow, ``properties.exclude: [target]``
``counts``      ``graph_data/model/**`` allow, ``properties.counts_only: [target]``
stays           ``llm/**`` and ``third_party/**`` allow, ``may_send`` without
                ``property_values``
==============  ============================================================

``*.price`` compiles to the bare ``price`` — every type that carries it.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.govern.addressing import Layer
from invana.apps.govern.models import GuardrailAccess
from invana.apps.govern.rules import EgressClass

WILDCARD = "*"

#: What may accompany a crossing out of a run when the result stays in the
#: Graph: everything but the values. The egress grammar is per class, so the cut
#: is wider than the one property — it fails closed.
STAYS_MAY_SEND: tuple[str, ...] = (
    EgressClass.type_names.value,
    EgressClass.property_names.value,
    EgressClass.the_question.value,
    EgressClass.record_ids.value,
    EgressClass.aggregates.value,
)

_MODEL_DATA = f"{Layer.graph_data.value}/model/**"
_CROSSINGS = (f"{Layer.llm.value}/**", f"{Layer.third_party.value}/**")


class TargetError(ValueError):
    """A target the grammar refuses. The message names the part that is wrong."""


@dataclass(frozen=True, slots=True)
class Target:
    """``Type.property``, either side possibly ``*``."""

    type_name: str
    property_name: str

    @property
    def text(self) -> str:
        return f"{self.type_name}.{self.property_name}"

    @property
    def any_type(self) -> bool:
        return self.type_name == WILDCARD

    @property
    def any_property(self) -> bool:
        return self.property_name == WILDCARD

    @property
    def property_entry(self) -> str:
        """How the target reads in ``properties`` — ``*.p`` compiles to bare ``p``."""
        return self.property_name if self.any_type else self.text

    def covers(self, type_name: str, property_name: str) -> bool:
        """Whether a reference to ``type_name.property_name`` is this target."""
        return (self.any_type or self.type_name == type_name) and (
            self.any_property or self.property_name == property_name
        )


def parse_target(text: str) -> Target:
    """``Deal.price`` → :class:`Target`, refusing anything that is not one dot between two names."""
    cleaned = (text or "").strip()
    parts = cleaned.split(".")
    if len(parts) != 2 or not all(part.strip() for part in parts):
        raise TargetError(f"{cleaned!r} is not a target — a guardrail names Type.property, either side may be *.")
    return Target(type_name=parts[0].strip(), property_name=parts[1].strip())


def check_rule(target: Target, access: GuardrailAccess, leaves: bool) -> None:
    """Refuse a rule that narrows nothing, or a wildcard property that cannot be compiled."""
    if access is GuardrailAccess.read and leaves:
        raise TargetError("This rule narrows nothing — Read with May leave permits everything.")
    if target.any_property and access is not GuardrailAccess.read:
        raise TargetError(
            f"{target.text} names every property, so it can only keep the result in the Graph — "
            "pick one property to keep out of reads or to count only."
        )


def compile_rules(target: Target, access: GuardrailAccess, leaves: bool) -> list[dict]:
    """The lens rules this property rule is enforced as."""
    rules: list[dict] = []
    if access is GuardrailAccess.never:
        rules.append({"match": _MODEL_DATA, "allow": True, "properties": {"exclude": [target.property_entry]}})
    elif access is GuardrailAccess.counts:
        rules.append({"match": _MODEL_DATA, "allow": True, "properties": {"counts_only": [target.property_entry]}})
    if not leaves:
        rules.extend(
            {"match": crossing, "allow": True, "egress": {"may_send": list(STAYS_MAY_SEND)}} for crossing in _CROSSINGS
        )
    return rules


def generated_name(target: Target, access: GuardrailAccess, leaves: bool) -> str:
    """``Deal.price never leaves`` · ``*.email never read`` · ``Deal.price in counts only``."""
    if access is GuardrailAccess.never:
        return f"{target.text} never read"
    if access is GuardrailAccess.counts:
        return f"{target.text} in counts only" + ("" if leaves else " · stays in the Graph")
    return f"{target.text} never leaves"


def sentence(target: Target, access: GuardrailAccess, leaves: bool) -> str:
    """The rule as the inspector reads it."""
    may = {
        GuardrailAccess.read: "may read it",
        GuardrailAccess.counts: "may read it in counts only",
        GuardrailAccess.never: "may never read it",
    }[access]
    result = "the result may leave" if leaves else "the result stays in the Graph"
    return f"When a run touches {target.text}, it {may}, and {result}."


def key_for(target: Target) -> str:
    """The guardrail's slug, from its target — ``guardrail-deal-price``, ``guardrail-all-email``."""
    parts = ["all" if part == WILDCARD else part for part in (target.type_name, target.property_name)]
    slug = "-".join("".join(ch if ch.isalnum() else "-" for ch in part.lower()).strip("-") for part in parts)
    return f"guardrail-{slug}"[:128]
