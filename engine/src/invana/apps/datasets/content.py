"""A version's content — keyed records, their columns and their hash.

Pure functions, no session: what a version *is* is decided here, before a row
is written, so the same records always hash the same whichever front-end
(the API body or the CLI's file) carried them.

Usage::

    rows = normalise(raw, key_column="accession")   # raises ValidationError
    content_hash(rows)                              # "sha256:…"
    columns_of(rows)                                # first-seen order
    property_changes(before.values, after.values)   # one record across versions
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from invana.apps.datasets.models import Origin
from invana.core.errors import ValidationError

#: The key a record carries its own provenance under; lifted out of its values.
PROVENANCE_KEY = "_provenance"
_PROVENANCE_FIELDS = ("origin", "source", "note")
_SHOWN = 5


@dataclass(frozen=True)
class Row:
    key: str
    values: dict[str, Any]
    provenance: dict[str, Any] | None


def _scalar(value: Any) -> bool:
    return value is None or isinstance(value, str | int | float | bool)


def _provenance(raw: Any, key: str) -> dict[str, Any] | None:
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) - set(_PROVENANCE_FIELDS):
        raise ValidationError(f"Record {key!r}: provenance takes only {', '.join(_PROVENANCE_FIELDS)}.")
    if raw.get("origin") is not None and raw["origin"] not in {o.value for o in Origin}:
        raise ValidationError(f"Record {key!r}: {raw['origin']!r} is not an origin.")
    kept = {k: v for k, v in raw.items() if v not in (None, "")}
    return kept or None


def normalise(records: list[dict[str, Any]], *, key_column: str) -> list[Row]:
    """Key each record, lift its provenance out and order the rows by key.

    A missing or duplicate key, or a nested value, refuses the whole version —
    naming the first five offenders, never one record silently dropped.
    """
    missing: list[int] = []
    nested: list[str] = []
    seen: dict[str, int] = {}
    duplicates: list[str] = []
    rows: list[Row] = []
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValidationError(f"Record {index + 1} is not an object.")
        values = dict(record)
        provenance_raw = values.pop(PROVENANCE_KEY, None)
        raw_key = values.get(key_column)
        if raw_key is None or str(raw_key).strip() == "":
            missing.append(index + 1)
            continue
        key = str(raw_key)
        if key in seen:
            duplicates.append(key)
            continue
        seen[key] = index
        for column, value in values.items():
            if not _scalar(value):
                nested.append(f"{key}.{column}")
        rows.append(Row(key=key, values=values, provenance=_provenance(provenance_raw, key)))

    if missing:
        shown = ", ".join(str(n) for n in missing[:_SHOWN])
        raise ValidationError(f"{len(missing)} record(s) have no {key_column!r}: record {shown}.")
    if duplicates:
        raise ValidationError(f"{len(duplicates)} duplicate {key_column!r}: {', '.join(duplicates[:_SHOWN])}.")
    if nested:
        raise ValidationError(f"A dataset is tables — nested values in {', '.join(nested[:_SHOWN])}.")
    if not rows:
        raise ValidationError("A version needs at least one record.")
    return sorted(rows, key=lambda r: r.key)


def content_hash(rows: list[Row]) -> str:
    """``sha256:`` over the records in key order, each with its provenance."""
    canonical = [{"key": r.key, "values": r.values, "provenance": r.provenance} for r in rows]
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return "sha256:" + hashlib.sha256(payload.encode()).hexdigest()


def columns_of(rows: list[Row]) -> list[str]:
    columns: dict[str, None] = {}
    for row in rows:
        for column in row.values:
            columns.setdefault(column, None)
    return list(columns)


def property_changes(before: dict[str, Any] | None, after: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Each property whose value differs, by name; absent on one side reads as null."""
    before = before or {}
    after = after or {}
    names = list(dict.fromkeys([*before, *after]))
    return [
        {"property": n, "before": before.get(n), "after": after.get(n)} for n in names if before.get(n) != after.get(n)
    ]


def records_summary(before: dict[str, Any], after: dict[str, Any]) -> tuple[int, int, int]:
    """``(added, removed, changed)`` between two versions' ``{key: (values, provenance)}``."""
    added = sum(1 for k in after if k not in before)
    removed = sum(1 for k in before if k not in after)
    changed = sum(1 for k in after if k in before and before[k] != after[k])
    return added, removed, changed
