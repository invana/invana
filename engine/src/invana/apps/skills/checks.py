"""The closed vocabulary of rule checks — what a rule may check, where, and at which acts.

A rule's **check** is its machine half: ``{kind, …params}`` from the table
below, never free text an engine interprets, so an auditor can read every
check there is (docs/for-developers/modules/skills/features/rules.md).

==========================  ===========================  ==============  =======================
kind                        params                       read at         scopes
==========================  ===========================  ==============  =======================
``dataset.conforms``        ``standard`` · ``min_score``  share · bind    install · graph
``dataset.licence``         ``allowed``                   share · bind    install · graph
``evidence.reviewed``       —                            decide          install · graph · project
``evidence.not_retracted``  —                            decide          install · graph · project
==========================  ===========================  ==============  =======================

Pure: whether a named standard exists is the manager's to ask.

Usage::

    stored = normalise_check({"kind": "dataset.licence", "allowed": ["CC-BY-4.0"]}, scope="install")
    kinds_at(ACT_DATASET_BIND)    # {"dataset.conforms", "dataset.licence"}
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from invana.core.errors import ValidationError

#: A dataset's visibility moving to ``install``.
ACT_DATASET_SHARE = "dataset.share"
#: A dataset version bound into a Graph.
ACT_DATASET_BIND = "dataset.bind"
#: A person recording a verdict and decision on a project branch.
ACT_PROJECT_DECIDE = "project.decide"

CONFORMS = "dataset.conforms"
LICENCE = "dataset.licence"
#: Every finding a decision cites was reviewed by a person.
REVIEWED = "evidence.reviewed"
#: No finding a decision cites cites a retracted dataset version.
NOT_RETRACTED = "evidence.not_retracted"

#: Every checked act, in the order a surface lists them.
ACTS = (ACT_DATASET_SHARE, ACT_DATASET_BIND, ACT_PROJECT_DECIDE)


@dataclass(frozen=True)
class CheckKind:
    acts: frozenset[str]
    scopes: frozenset[str]
    params: frozenset[str]


CHECK_KINDS: dict[str, CheckKind] = {
    CONFORMS: CheckKind(
        acts=frozenset({ACT_DATASET_SHARE, ACT_DATASET_BIND}),
        scopes=frozenset({"install", "graph"}),
        params=frozenset({"standard", "min_score"}),
    ),
    LICENCE: CheckKind(
        acts=frozenset({ACT_DATASET_SHARE, ACT_DATASET_BIND}),
        scopes=frozenset({"install", "graph"}),
        params=frozenset({"allowed"}),
    ),
    REVIEWED: CheckKind(
        acts=frozenset({ACT_PROJECT_DECIDE}),
        scopes=frozenset({"install", "graph", "project"}),
        params=frozenset(),
    ),
    NOT_RETRACTED: CheckKind(
        acts=frozenset({ACT_PROJECT_DECIDE}),
        scopes=frozenset({"install", "graph", "project"}),
        params=frozenset(),
    ),
}


def kinds_at(act: str) -> set[str]:
    """The check kinds an act reads."""
    return {kind for kind, spec in CHECK_KINDS.items() if act in spec.acts}


def acts_of(kind: str) -> list[str]:
    """The acts a check kind is read at, in the order a surface lists them."""
    spec = CHECK_KINDS.get(kind)
    return [a for a in ACTS if spec is not None and a in spec.acts]


def normalise_check(check: dict[str, Any], *, scope: str) -> dict[str, Any]:
    """Validate a check for a rule at *scope* and return its stored form."""
    kind = check.get("kind")
    spec = CHECK_KINDS.get(kind or "")
    if spec is None:
        raise ValidationError(f"{kind!r} is not a check — a check is one of {', '.join(sorted(CHECK_KINDS))}.")
    if scope not in spec.scopes:
        raise ValidationError(
            f"No {scope} act reads a {kind} check yet — it sits on {' or '.join(sorted(spec.scopes))} rules."
        )
    given = {k: v for k, v in check.items() if k != "kind" and v is not None}
    unknown = set(given) - spec.params
    if unknown:
        raise ValidationError(f"A {kind} check carries no {', '.join(sorted(unknown))}.")

    if kind == CONFORMS:
        standard = str(given.get("standard") or "").strip()
        if not standard or "@" in standard:
            raise ValidationError("A dataset.conforms check names a standard as publisher/name.")
        min_score = float(given.get("min_score", 1.0))
        if not 0.0 <= min_score <= 1.0:
            raise ValidationError("min_score is between 0 and 1.")
        return {"kind": kind, "standard": standard, "min_score": min_score}

    if not spec.params:
        return {"kind": kind}

    allowed = given.get("allowed")
    if not isinstance(allowed, list) or not [a for a in allowed if str(a).strip()]:
        raise ValidationError("A dataset.licence check lists the licences it allows.")
    return {"kind": kind, "allowed": sorted({str(a).strip() for a in allowed if str(a).strip()})}
