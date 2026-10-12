"""The declarations — what a plugin is, and what each task type spends, takes and produces.

A task type is declared by its ``manifest.toml`` beside its ``run.py``; the
loader in :mod:`invana.plugins.registry` reads it into a :class:`TaskManifest`.
One artifact, four readers (docs/for-developers/orchestration.md §0.6):

| Read by | For |
|---|---|
| the **planner** | what may I name, and what must I order before it |
| the **validator** | is this plan legal, before anything is dispatched |
| the **interpreter** | how lane outputs roll up (§5.1b) |
| ``when`` / ``until`` / ``${steps.x.y}`` | what there is to bind |

The set is **closed per process**: task types come only from the plugins
loaded at start-up, and nothing registers one while plans run — a module that
could would make the envelope advisory
(docs/for-developers/building-engine/the-runtime-package.md §1).

``requires`` is declared on the task type rather than in the envelope so the
planner reads it **while drafting** instead of being refused and redrafting. It
is the same line the validator enforces.
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
class SpecField:
    """One field of a simulator's spec — checked by Invana before a run opens."""

    type: Type
    required: bool = False
    default: Any = None
    #: What a form labels it.
    label: str = ""


class SideEffect(StrEnum):
    """What a task type does to the world — ``send`` always needs an approval."""

    read = "read"
    write = "write"
    send = "send"


class Resource(StrEnum):
    """What a worker must offer to run a task type."""

    llm = "llm"
    cpu = "cpu"
    gpu = "gpu"


@dataclass(frozen=True, slots=True)
class TaskManifest:
    """One task type: one act, one bound, one failure mode."""

    key: str
    bound: Bound
    run: Callable[..., Any]
    args: Mapping[str, Arg] = field(default_factory=dict)
    outputs: Mapping[str, Type] = field(default_factory=dict)
    #: Keys a plan naming this one must already order before it.
    requires: tuple[str, ...] = ()
    #: The one line the catalogue drawer shows.
    summary: str = ""
    #: Semver of the task type itself, independent of its plugin's.
    version: str = "1.0.0"
    side_effect: SideEffect = SideEffect.read
    resources: tuple[Resource, ...] = (Resource.cpu,)
    #: Declared defaults for an executor; nothing applies them yet.
    timeout_s: int | None = None
    retries: int | None = None
    #: The plugin that declares it, e.g. ``invana.core.graph_read``.
    plugin: str = ""
    #: A simulator's spec fields — what a caller fills in; empty on every other task type.
    spec: Mapping[str, SpecField] = field(default_factory=dict)

    @property
    def ref(self) -> str:
        return f"{self.key}@{self.version}"

    def declares(self, output: str) -> bool:
        """Whether ``${steps.<this>.<output>}`` has anything to bind to.

        A dotted path binds against its **head**: ``intent.kind`` reads into a
        declared ``obj``, and only the head is the task type's promise.
        """
        return output.split(".", 1)[0] in self.outputs


#: The name every importer already uses for a task type.
Entry = TaskManifest


@dataclass(frozen=True, slots=True)
class FlowManifest:
    """A packaged flow — a fixed multi-step plan a plugin ships, seeded into every library.

    ``steps`` are in the envelope grammar (:mod:`invana.apps.agents.envelope`):
    ``{id, task, label, args}``. A version is immutable; a changed shape is
    ``key@n+1``.
    """

    key: str
    version: int
    description: str
    intents: tuple[str, ...]
    steps: tuple[dict, ...]
    #: The plan's subject — ``ask · import · bulk · stitch · model · enrich · canvas``.
    kind: str = "ask"
    tags: tuple[str, ...] = ()
    #: What the flow offers a caller that inlines it — ``{name: {type, default, label}}``.
    args_schema: Mapping[str, Any] = field(default_factory=dict)
    plugin: str = ""

    @property
    def ref(self) -> str:
        return f"{self.key}@{self.version}"


@dataclass(frozen=True, slots=True)
class PluginManifest:
    """A plugin, as its ``plugin.toml`` declares it."""

    name: str
    version: str
    #: ``core`` · ``tool`` · ``simulator`` · ``mcp``.
    kind: str
    #: The engine versions it runs on, as a specifier.
    engine: str = "*"
    #: The pip extra that installs it; empty for a core plugin.
    extra: str = ""
    #: The secret names its task types may resolve inside a worker.
    secrets: tuple[str, ...] = ()
    #: What a person calls it — a simulator's chip; empty for a core plugin.
    title: str = ""


def build(*entries: TaskManifest) -> dict[str, TaskManifest]:
    """Index task types by key, refusing a duplicate rather than shadowing one."""
    out: dict[str, TaskManifest] = {}
    for entry in entries:
        if entry.key in out:
            raise ValueError(f"duplicate task type key '{entry.key}'")
        out[entry.key] = entry
    return out
