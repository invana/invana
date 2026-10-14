"""Rule checks — what an eval case asks of an answer, counted from the run's record.

Nothing here asks a model. A check reads facts a settled run already holds —
its outcome, the records its emissions cite, the world it froze, what the lens
refused, its tokens and its latency — so a hard check gives the same verdict
every time it reads the same run. That is what lets a failed one block a
publish while a judged score only warns
(docs/for-developers/modules/skills/features/evals.md).

``CaseRecord`` is the run reduced to those facts; ``EvalManager`` builds it from
the rows, and ``verdicts`` is the pure part.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

#: The world a run that froze none ran in.
EVERYTHING = "Everything"

#: Every check kind, and the type its ``value`` must have (None: no value).
CHECK_KINDS: dict[str, type | tuple[type, ...] | None] = {
    "cites_records": None,
    "names_world": str,
    "cannot_answer": None,
    "guardrail_holds": None,
    "expected_records": list,
    "max_tokens": int,
    "max_latency_ms": int,
}

#: How much of an answer the judge is handed.
ANSWER_CAP = 4000


@dataclass(frozen=True, slots=True)
class CaseRecord:
    """One replayed ask, as the facts its checks read."""

    outcome: str | None
    tokens: int
    latency_ms: int
    world: str
    cited_ids: frozenset[str] = field(default_factory=frozenset)
    record_count: int = 0
    #: No address both refused and answered.
    guardrail_held: bool = True
    answer: str = ""


def check_problem(check: Mapping[str, Any]) -> str | None:
    """Why one check cannot be saved, as a sentence; None when it can."""
    kind = check.get("kind")
    if kind not in CHECK_KINDS:
        return f"'{kind}' is not a check. Use one of: {', '.join(CHECK_KINDS)}."
    wanted = CHECK_KINDS[kind]
    value = check.get("value")
    if wanted is None:
        return None
    if wanted is int and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
        return f"'{kind}' needs a whole number of at least 0."
    if wanted is str and not (isinstance(value, str) and value.strip()):
        return f"'{kind}' needs the world's name."
    if wanted is list and not (isinstance(value, list) and value and all(isinstance(v, str) for v in value)):
        return f"'{kind}' needs a list of record ids."
    return None


def verdicts(checks: Iterable[Mapping[str, Any]], rec: CaseRecord) -> dict[str, str]:
    """``{kind: pass | fail}`` for every check of one case against one run."""
    out: dict[str, str] = {}
    for check in checks:
        kind = str(check.get("kind"))
        out[kind] = "pass" if _passes(kind, check.get("value"), rec) else "fail"
    return out


def _passes(kind: str, value: Any, rec: CaseRecord) -> bool:
    match kind:
        case "cites_records":
            return rec.record_count > 0 or bool(rec.cited_ids)
        case "names_world":
            return rec.world.casefold() == str(value).strip().casefold()
        case "cannot_answer":
            return rec.outcome == "cannot_answer"
        case "guardrail_holds":
            return rec.guardrail_held
        case "expected_records":
            return set(value or ()) <= rec.cited_ids
        case "max_tokens":
            return rec.tokens <= int(value)
        case "max_latency_ms":
            return rec.latency_ms <= int(value)
    return False


def cited_ids(payloads: Iterable[Any]) -> frozenset[str]:
    """Every record ``id`` in a run's emission payloads — nodes, edges, rows."""
    found: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, Mapping):
            rid = node.get("id")
            if isinstance(rid, (str, int)) and not isinstance(rid, bool):
                found.add(str(rid))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for payload in payloads:
        walk(payload)
    return frozenset(found)


def answer_text(emissions: Iterable[tuple[str, Mapping[str, Any]]], *, outcome: str | None, reason: str = "") -> str:
    """The answer as text — prose verbatim, a table's first rows, a subgraph's counts.

    What the judge reads and what ``answer_digest`` hashes, capped at
    ``ANSWER_CAP`` characters.
    """
    parts: list[str] = []
    if outcome == "cannot_answer":
        parts.append(f"Cannot answer: {reason}".strip())
    for kind, payload in emissions:
        if kind == "prose":
            parts.append(str(payload.get("text") or ""))
        elif kind == "subgraph":
            nodes, edges = payload.get("nodes") or [], payload.get("edges") or []
            parts.append(f"A subgraph of {len(nodes)} nodes and {len(edges)} edges.")
        elif kind == "empty":
            parts.append("No records.")
        else:
            parts.append(json.dumps(_head(payload), default=str, sort_keys=True))
    return "\n".join(p for p in parts if p)[:ANSWER_CAP]


def _head(payload: Mapping[str, Any], rows: int = 10) -> dict[str, Any]:
    """A table's or a chart's payload with only its first rows."""
    return {k: (v[:rows] if isinstance(v, list) else v) for k, v in payload.items()}


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def p95(values: list[int]) -> int:
    """The 95th percentile by nearest rank; 0 for none."""
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[max(0, -(-95 * len(ordered) // 100) - 1)]
