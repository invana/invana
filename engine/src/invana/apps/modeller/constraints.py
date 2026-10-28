"""Constraints on properties — what a range or a standard's values says, and when a value breaks it.

docs/for-developers/modules/connect-and-model/features/property-constraints.md.

A constraint is a validation rule on a type's property mapping: ``range``
(``params = {min, max}`` and a ``unit``) or ``standard`` (``params = {values}``,
copied from a pinned standard version's term, with its ``standard_ref`` and
``term``). An ``enum`` rule bounds values the same way, without a standard.
Each carries ``on_break`` — ``reject`` refuses a breaking record, ``flag`` lets
it land and lists it.

Every place a record lands reads these functions — the model's
``SchemaValidator`` (every load's validate step, a binding's load, the publish
migration scan) and an Explorer board's data edits — so a constraint means one
thing wherever it is checked, and a refusal always names it the same way.

Usage::

    if breaks(value, rule):
        raise ... refusal(type_name, prop, rule, value)
"""

from __future__ import annotations

from typing import Any

#: The rule types that bound a property's values.
VALUE_RULES = frozenset({"range", "enum", "standard"})

_EN_DASH = "–"  # noqa: RUF001 — the board's range dash


def _get(rule: Any, key: str, default: Any = None) -> Any:
    if isinstance(rule, dict):
        return rule.get(key, default)
    return getattr(rule, key, default)


def _number(value: float | int | None) -> str:
    if value is None:
        return ""
    as_float = float(value)
    return str(int(as_float)) if as_float.is_integer() else str(as_float)


def constraint_label(rule: Any) -> str:
    """The constraint as a person reads it: the bounds and unit, or ``CO_338 · Seed type``."""
    kind = _get(rule, "rule_type")
    params = _get(rule, "params") or {}
    if kind == "range":
        low, high = params.get("min"), params.get("max")
        unit = _get(rule, "unit")
        if low is not None and high is not None:
            text = f"{_number(low)} {_EN_DASH} {_number(high)}"
        elif low is not None:
            text = f"≥ {_number(low)}"
        else:
            text = f"≤ {_number(high)}"
        return f"{text} {unit}" if unit else text
    if kind == "standard":
        ref = (_get(rule, "standard_ref") or "").split("@", 1)[0]
        name = ref.split("/", 1)[-1] if ref else "standard"
        return f"{name} · {_get(rule, 'term') or ''}".strip()
    if kind == "enum":
        return " · ".join(str(v) for v in params.get("values", []))
    return str(kind)


def breaks(value: Any, rule: Any) -> bool:
    """True when ``value`` is outside the rule's range or not among its values.

    A missing value never breaks a constraint; a value a range cannot compare
    (text in a numeric range) breaks it.
    """
    if value is None:
        return False
    kind = _get(rule, "rule_type")
    params = _get(rule, "params") or {}
    if kind == "range":
        low, high = params.get("min"), params.get("max")
        try:
            return (low is not None and value < low) or (high is not None and value > high)
        except TypeError:
            return True
    if kind in ("enum", "standard"):
        allowed = params.get("values", [])
        if isinstance(value, list):
            return any(v not in allowed for v in value)
        return value not in allowed
    return False


def refusal(type_name: str, prop: str, rule: Any, value: Any) -> str:
    """The message a breaking value is refused or flagged with — the constraint named."""
    subject = f"{type_name}.{prop}" if type_name else prop
    return f"{subject} breaks its constraint {constraint_label(rule)}: {value!r}"


def flags(rule: Any) -> bool:
    """True when a break of ``rule`` lets the record land and lists it."""
    return (_get(rule, "on_break") or "reject") == "flag"
