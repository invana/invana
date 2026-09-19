"""The declaration — what every catalogue entry spends, takes and produces.

One artifact, four readers
(docs/for-developers/orchestration.md §0.6):

| Read by | For |
|---|---|
| the **planner** | what may I name, and what must I order before it |
| the **validator** | is this plan legal, before anything is dispatched |
| the **interpreter** | how lane outputs roll up (§5.1b) |
| ``when`` / ``until`` / ``${steps.x.y}`` | what there is to bind |

The set is **closed**: entries are declared here and nowhere else. Nothing
registers one back into the runtime — an app that could would close an import
cycle *and* make the envelope advisory
(docs/for-developers/building-engine/the-runtime-package.md §1).

``requires`` is declared here rather than in the envelope so the planner reads
it **while drafting** instead of being refused and redrafting. It is the same
line the validator enforces.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class Bound(StrEnum):
    """What an entry spends — **the group the envelope ceilings**.

    An entry consumes exactly one. An entry that spent two could not be
    ceilinged, because the ceiling is per bound.
    """

    none = "none"
    network = "network"
    graph_read = "graph_read"
    graph_write = "graph_write"
    schema_write = "schema_write"
    ingest = "ingest"
    llm = "llm"
    plan_write = "plan_write"
    work_write = "work_write"


class Type(StrEnum):
    """The declared type of an arg or an output.

    On a fanned-out node the output type **is** the aggregation rule
    (docs/for-developers/orchestration.md §5.1b) — which is why there is no
    fourth place to keep in sync.
    """

    str_ = "str"
    int_ = "int"
    float_ = "float"
    bool_ = "bool"
    list_ = "list"
    obj = "obj"

    @property
    def aggregation(self) -> str | None:
        """How lanes roll up: ``sum``, ``concat``, or not exposed at all."""
        if self in (Type.int_, Type.float_):
            return "sum"
        if self is Type.list_:
            return "concat"
        return None


@dataclass(frozen=True, slots=True)
class Arg:
    type: Type
    required: bool = False
    default: Any = None


@dataclass(frozen=True, slots=True)
class Entry:
    """One act, one bound, one failure mode."""

    key: str
    bound: Bound
    run: Callable[..., Any]
    args: Mapping[str, Arg] = field(default_factory=dict)
    outputs: Mapping[str, Type] = field(default_factory=dict)
    #: Step keys a plan naming this one must already order before it.
    requires: tuple[str, ...] = ()

    def declares(self, output: str) -> bool:
        """Whether ``${steps.<this>.<output>}`` has anything to bind to.

        A dotted path binds against its **head**: ``intent.kind`` reads into a
        declared ``obj``, and only the head is the catalogue's promise.
        """
        return output.split(".", 1)[0] in self.outputs


def build(*entries: Entry) -> dict[str, Entry]:
    """Index entries by key, refusing a duplicate rather than shadowing one."""
    out: dict[str, Entry] = {}
    for entry in entries:
        if entry.key in out:
            raise ValueError(f"duplicate catalogue key '{entry.key}'")
        out[entry.key] = entry
    return out
