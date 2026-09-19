"""What a fanned-out node exposes (docs/for-developers/orchestration.md §5.1b).

A ``map_over`` node runs N lanes, so ``${steps.load.written}`` has to mean
something definite across them. **It follows from the output's declared type**
— there is no fourth place to keep in sync:

| On a node with `map_over` | Is |
|---|---|
| `.lanes` · `.succeeded` · `.failed` | counts — on every fanned-out node, whatever the callable |
| `.failed_lanes` | the lane keys that failed, with reasons |
| a declared `int` / `float` output | **summed** over succeeded lanes |
| a declared `list` output | **concatenated** |
| any other declared output | **not exposed** — bind it per lane, or have the entry declare an aggregate |

An **undeclared** key is not exposed either, whatever a lane happened to put in
its output: the declaration is the contract, and a roll-up over something the
entry never promised is the undocumented API §0.6 refuses.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from invana.runtime.catalogue.registry import Entry

#: The keys every fanned-out node carries. Reserved: a declared output of the
#: same name would be shadowed, so the registry must never mint one.
COUNTS = ("lanes", "succeeded", "failed", "failed_lanes")


@dataclass(frozen=True, slots=True)
class Lane:
    """One lane's settled result."""

    key: str
    succeeded: bool
    output: Mapping[str, Any]
    reason: str | None = None


def aggregate(entry: Entry, lanes: Sequence[Lane]) -> dict[str, Any]:
    """Roll N lanes up into the one shape ``${steps.x.y}`` binds against.

    Only **succeeded** lanes contribute to a sum or a concatenation: a lane that
    failed has no number to add and no rows to append, and counting it would
    make ``written > 0`` true for a load that wrote nothing.
    """
    ok = [lane for lane in lanes if lane.succeeded]
    failed = [lane for lane in lanes if not lane.succeeded]
    out: dict[str, Any] = {
        "lanes": len(lanes),
        "succeeded": len(ok),
        "failed": len(failed),
        "failed_lanes": [{"lane": lane.key, "reason": lane.reason} for lane in failed],
    }

    for name, declared in entry.outputs.items():
        if name in COUNTS:
            continue
        rule = declared.aggregation
        if rule == "sum":
            total: float = 0
            for lane in ok:
                value = lane.output.get(name)
                if isinstance(value, bool) or not isinstance(value, int | float):
                    continue
                total += value
            out[name] = int(total) if declared == "int" else total
        elif rule == "concat":
            joined: list[Any] = []
            for lane in ok:
                value = lane.output.get(name)
                if isinstance(value, list):
                    joined.extend(value)
            out[name] = joined
        # Anything else is deliberately absent — bind it per lane.
    return out
