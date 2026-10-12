"""Project types — the words a project speaks in
(docs/for-developers/modules/work/features/branches-and-decisions.md).

A type relabels; it never changes what is stored. Verdicts and decisions are
kept in their canonical words (``supported · refuted · inconclusive`` and
``pursue · park · drop · merge``) and this table turns them into the type's on
the way out, so changing a project's type rewrites nothing.

Three types are launched. The other three are defined so their words are
reviewed with the rest, and refused at create until a real user for that
persona exists.

Pure: no database.

Usage::

    words = vocabulary("policy")
    words.branch                 # "Option"
    words.verdicts["refuted"]    # "harmful"
"""

from __future__ import annotations

from dataclasses import dataclass, field

from invana.core.errors import ValidationError


@dataclass(frozen=True)
class Vocabulary:
    branch: str
    evidence: str
    # canonical → the type's word
    verdicts: dict[str, str] = field(default_factory=dict)
    choices: dict[str, str] = field(default_factory=dict)
    opens_first: tuple[str, ...] = ()


def _words(branch: str, evidence: str, verdicts: str, choices: str, opens: tuple[str, ...]) -> Vocabulary:
    supported, refuted, inconclusive = (w.strip() for w in verdicts.split("·"))
    pursue, park, drop = (w.strip() for w in choices.split("·"))
    return Vocabulary(
        branch=branch,
        evidence=evidence,
        verdicts={"supported": supported, "refuted": refuted, "inconclusive": inconclusive},
        choices={"pursue": pursue, "park": park, "drop": drop, "merge": "merge"},
        opens_first=opens,
    )


TYPES: dict[str, Vocabulary] = {
    "research": _words(
        "Hypothesis", "Finding", "supported · refuted · inconclusive", "pursue · park · drop", ("simulate", "lineage")
    ),
    "investment": _words("Thesis", "Signal", "holds · broken · unclear", "invest · hold · pass", ("scenarios", "risk")),
    "policy": _words("Option", "Evidence", "effective · harmful · unclear", "adopt · amend · reject", ("impact",)),
    "market": _words("Position", "Insight", "validated · invalidated · mixed", "go · revise · no-go", ("comparison",)),
    "investigation": _words(
        "Lead", "Evidence", "confirmed · ruled out · open", "escalate · monitor · close", ("lineage", "timeline")
    ),
    "general": _words("Option", "Evidence", "supported · against · unclear", "choose · park · drop", ("overview",)),
}

LAUNCHED: frozenset[str] = frozenset({"research", "policy", "general"})


def vocabulary(project_type: str) -> Vocabulary:
    """The words of a type; an unknown stored type reads as ``general``."""
    return TYPES.get(project_type, TYPES["general"])


def require_launched(project_type: str) -> str:
    if project_type not in TYPES:
        raise ValidationError(f"{project_type!r} is not a project type — one of {', '.join(TYPES)}.")
    if project_type not in LAUNCHED:
        raise ValidationError(f"The {project_type} type is not switched on yet — choose {', '.join(sorted(LAUNCHED))}.")
    return project_type
