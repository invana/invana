"""Declared arguments, and the one place they are resolved.

A reusable plan **offers** arguments — ``args_schema`` — and its own rows bind
them as ``${args.<name>}``. Nobody ever runs one of those markers: it is
resolved before the plan is validated, either against a caller's tuned values
when a skill inlines the plan
([SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)) or
against the declared defaults when the plan is selected directly, because a
plan run on its own is a plan run on what it declares
([LB20](docs/for-developers/modules/workflows/features/the-library.md)).

Two rules, and they are the whole module:

* **a name the plan does not declare is refused**, beside the names it does —
  an argument nothing offers is a typo, and a typo that survived would reach a
  run as the literal string ``${args.grace_dyas}``;
* **a tuned value must match the declared type**, because a plan that cannot
  run is better discovered by the person tuning it than by the run at 3am.

What is *not* resolved here stays a marker on purpose: an argument declared
with no default that nobody supplied. The validator then refuses it by name,
which is the honest reading — *this plan needs it, and nothing gave it one*.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

#: The marker, matched whole. A value is an argument or it is not one — an
#: argument spliced into the middle of a sentence would make *what did this
#: step run with* a string-building question.
ARG = re.compile(r"^\$\{args\.([A-Za-z0-9_]+)\}$")

#: What a declaration may say a value is. Three, and closed: a type nothing can
#: check is a declaration that does not bound anything.
TYPES: dict[str, type | tuple[type, ...]] = {"str": str, "int": int, "bool": bool}


class ArgError(ValueError):
    """A tuning the declaration refuses. The message names the argument."""


def check_tuning(declared: Mapping[str, Any], tuned: Mapping[str, Any]) -> None:
    """Refuse a tuning before anything is written, naming what is wrong."""
    for name, value in tuned.items():
        spec = declared.get(name)
        if spec is None:
            offered = ", ".join(sorted(declared)) or "none"
            raise ArgError(f"'{name}' is not an argument this plan declares (it declares: {offered}).")
        wanted = TYPES.get(str(spec.get("type") or "str"), str)
        # `bool` is a subclass of `int`, so an int argument must refuse `True`
        # explicitly — otherwise `grace_days: true` would pass as 1.
        if wanted is int and isinstance(value, bool):
            raise ArgError(f"'{name}' is a number, and true is not one.")
        if not isinstance(value, wanted):
            raise ArgError(f"'{name}' is declared {spec.get('type')}, and {value!r} is not.")


def resolve(steps: list[dict], *, declared: Mapping[str, Any], tuned: Mapping[str, Any] | None = None) -> list[dict]:
    """Substitute every ``${args.N}`` these steps bind, tuned over declared.

    Returns new dicts: the plan being read from is the library's, and writing
    through it would edit the row every other caller reads.
    """
    values = {name: spec.get("default") for name, spec in declared.items() if "default" in spec}
    values.update(tuned or {})

    out: list[dict] = []
    for step in steps:
        args = dict(step.get("args") or {})
        for key, value in args.items():
            if not isinstance(value, str):
                continue
            match = ARG.match(value)
            if match is not None and match.group(1) in values:
                args[key] = values[match.group(1)]
        out.append({**step, "args": args})
    return out
