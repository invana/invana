"""Resolving ``${steps.x.y}`` immediately before a step is dispatched.

The validator proved the reference is legal — it names an **earlier** step and
a field that step's catalogue entry **declares**
(docs/for-developers/orchestration.md §0.6). This turns that proven reference
into the value, so an entry reads a literal and never a path.

**One grammar, one surface.** The pattern here is the validator's pattern, and
it is matched against the *whole* string on a **top-level** arg — exactly what
`validate_plan` checks. Resolving somewhere the validator does not look would
create a path into a step that nothing proved legal, which is the hole the
closed catalogue exists to shut.

The grammar is inert data: a path lookup, not an expression, so there is
nowhere for a model to put code.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

#: The validator's pattern, deliberately duplicated as a constant rather than
#: imported from `apps/agents`: band 3 may import band 2, but the grammar is a
#: shared fact and a future move of either side should break this test, not
#: silently drift.
_BINDING = re.compile(r"^\$\{steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_.]+)\}$")


def resolve(args: Mapping[str, Any] | None, outputs: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """This step's args with every binding replaced by what it names.

    ``outputs`` is ``{step_id: that step's settled output}``.

    A binding whose value is **absent** resolves to ``None`` rather than
    failing. The validator guarantees the *field* is declared; it cannot
    guarantee the step produced one — ``rationale`` is legitimately null on a
    query the model did not explain. ``None`` is what the entry's own
    ``args.get(...) or <fallback>`` already reads, so the absent case behaves
    as it does for a plan that never bound the arg at all.
    """
    resolved: dict[str, Any] = {}
    for key, value in (args or {}).items():
        match = _BINDING.match(value) if isinstance(value, str) else None
        resolved[key] = _walk(outputs.get(match.group(1)), match.group(2)) if match else value
    return resolved


def _walk(output: Mapping[str, Any] | None, path: str) -> Any:
    """Follow a dotted path into one step's output. A dead end is ``None``."""
    current: Any = output
    for segment in path.split("."):
        if not isinstance(current, Mapping):
            return None
        current = current.get(segment)
    return current
