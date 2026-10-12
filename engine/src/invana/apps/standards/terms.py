"""A standard's terms, and how records are scored against them.

Pure functions, no session: what a version's terms *are* and whether a record
conforms are decided here, so the API, the CLI and a rule's check all score
the same records the same way.

Usage::

    terms = normalise_terms(raw)                 # raises ValidationError
    terms_hash(terms)                            # "sha256:…"
    result = score(terms, mapping, rows)         # rows: [(key, {column: value})]
    result.score, result.violations
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any

from invana.apps.standards.models import TermType
from invana.core.errors import ValidationError

#: Kept per conformance row; ``violation_count`` is the whole.
MAX_VIOLATIONS = 50
_TERM_KEYS = {"name", "type", "required", "values", "description", "iri"}
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalise_terms(raw: list[Any]) -> list[dict[str, Any]]:
    """Validate the terms and give each its defaults — the stored form."""
    if not isinstance(raw, list) or not raw:
        raise ValidationError("A standard version needs at least one term.")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, term in enumerate(raw):
        if not isinstance(term, dict):
            raise ValidationError(f"Term {index + 1} is not an object.")
        unknown = set(term) - _TERM_KEYS
        if unknown:
            raise ValidationError(f"Term {index + 1} carries no {', '.join(sorted(unknown))}.")
        name = str(term.get("name") or "").strip()
        if not name:
            raise ValidationError(f"Term {index + 1} has no name.")
        if name in seen:
            raise ValidationError(f"Term {name!r} is named twice.")
        seen.add(name)
        try:
            kind = TermType(term.get("type") or TermType.text.value)
        except ValueError:
            raise ValidationError(f"Term {name!r}: {term.get('type')!r} is not a type.") from None
        stored: dict[str, Any] = {"name": name, "type": kind.value, "required": bool(term.get("required", False))}
        values = term.get("values")
        if values is not None:
            stored["values"] = _values(name, values)
        if term.get("description"):
            stored["description"] = str(term["description"])
        if term.get("iri"):
            stored["iri"] = str(term["iri"])
        out.append(stored)
    return out


def _values(name: str, raw: Any) -> list[dict[str, str]]:
    """Codes unique; ``broader`` names another code of the same term."""
    if not isinstance(raw, list) or not raw:
        raise ValidationError(f"Term {name!r}: values is a non-empty list of codes.")
    out: list[dict[str, str]] = []
    codes: set[str] = set()
    for entry in raw:
        item = entry if isinstance(entry, dict) else {"code": entry}
        code = str(item.get("code") if item.get("code") is not None else "").strip()
        if not code:
            raise ValidationError(f"Term {name!r}: a value has no code.")
        if code in codes:
            raise ValidationError(f"Term {name!r}: code {code!r} is listed twice.")
        codes.add(code)
        value = {"code": code}
        for key in ("label", "iri", "broader"):
            if item.get(key):
                value[key] = str(item[key])
        out.append(value)
    for value in out:
        if value.get("broader") is not None and value["broader"] not in codes:
            raise ValidationError(
                f"Term {name!r}: {value['code']!r} is under {value['broader']!r}, which is not a code."
            )
    return out


def terms_hash(terms: list[dict[str, Any]]) -> str:
    """``sha256:`` over the terms in authored order."""
    payload = json.dumps(terms, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(payload.encode()).hexdigest()


@dataclass
class Score:
    record_count: int = 0
    conforming: int = 0
    violation_count: int = 0
    violations: list[dict[str, Any]] = field(default_factory=list)

    @property
    def score(self) -> float:
        return 1.0 if self.record_count == 0 else round(self.conforming / self.record_count, 4)

    @property
    def conforms(self) -> bool:
        return self.violation_count == 0


def _empty(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _typed(kind: str, value: Any) -> bool:
    """Whether *value* reads as *kind*. Text from a CSV counts when it parses."""
    if kind == TermType.text:
        return True
    if kind == TermType.boolean:
        return isinstance(value, bool) or str(value).strip().lower() in {"true", "false"}
    if isinstance(value, bool):
        return False
    if kind == TermType.integer:
        return isinstance(value, int) or bool(re.fullmatch(r"-?\d+", str(value).strip()))
    if kind == TermType.number:
        if isinstance(value, int | float):
            return True
        try:
            float(str(value).strip())
        except ValueError:
            return False
        return True
    if kind == TermType.date:
        return bool(_DATE.match(str(value).strip()))
    return False


def score(terms: list[dict[str, Any]], mapping: dict[str, str], rows: list[tuple[str, dict[str, Any]]]) -> Score:
    """Score each record against every term; a record conforms when none breaks.

    A required term with no column is ``missing`` on every record — a column is
    never guessed.
    """
    result = Score(record_count=len(rows))
    for key, values in rows:
        broken = False
        for term in terms:
            column = mapping.get(term["name"])
            value = values.get(column) if column is not None else None
            kind: str | None = None
            if _empty(value):
                kind = "missing" if term["required"] else None
            elif not _typed(term["type"], value):
                kind = "wrong_type"
            elif term.get("values") is not None and str(value).strip() not in {v["code"] for v in term["values"]}:
                kind = "not_allowed"
            if kind is None:
                continue
            broken = True
            result.violation_count += 1
            if len(result.violations) < MAX_VIOLATIONS:
                entry: dict[str, Any] = {"key": key, "term": term["name"], "kind": kind}
                if not _empty(value):
                    entry["value"] = value
                result.violations.append(entry)
        if not broken:
            result.conforming += 1
    return result


def first_violations(violations: list[dict[str, Any]], shown: int = 3) -> str:
    """``CS1.country not_allowed, …`` — for a refusal's message."""
    return ", ".join(f"{v['key']}.{v['term']} {v['kind']}" for v in violations[:shown])
