"""The registry — every plugin loaded in this process, its task types and its flows.

Built once from the manifests on disk and then **frozen**: nothing registers a
task type while plans run, which is what keeps the envelope enforceable
(docs/for-developers/orchestration.md §0.6).

A plugin is a folder:

| Path | Holds |
|---|---|
| ``plugin.toml`` | ``name · kind · engine · extra · secrets · title`` and the ordered ``tasks`` and ``flows`` |
| ``tasks/<folder>/manifest.toml`` | the task manifest — :class:`~invana.plugins.sdk.manifest.TaskManifest` |
| ``tasks/<key>/run.py`` | ``async def run(ctx, v) -> Out`` |
| ``flows/<key>.toml`` | a packaged flow — :class:`~invana.plugins.sdk.manifest.FlowManifest` |

Every check is made at load, and a failure raises :class:`PluginError` naming
the file, so a manifest that drifted from its code stops the process at start
rather than a plan at run time. A core plugin's version is the engine's, and a
task key's last dotted segment is its folder (``sim.genomic_prediction`` →
``tasks/genomic_prediction/``).

Two kinds load today: the **core** plugins, always, and the **simulator**
plugins under ``simulators/`` (docs/for-developers/modules/work/features/simulation.md).
A simulator plugin contributes exactly one simulator — one task type held to
the simulator contract (:func:`_check_simulator`) and the one ``simulate`` flow
that runs it — and is listed in :attr:`Registry.simulators` as well as among the
task types.

Usage::

    from invana.plugins import load_plugins

    registry = load_plugins()
    registry.task("execute_graph_query")        # latest version of a key
    registry.task("execute_graph_query@1.0.0")  # one exact version
    registry.flows["model-import"]
    registry.simulator("sim.genomic_prediction")
"""

from __future__ import annotations

import importlib
import importlib.metadata
import inspect
import tomllib
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType

from invana.plugins.sdk.manifest import (
    Arg,
    Bound,
    FlowManifest,
    PluginManifest,
    Resource,
    SideEffect,
    SpecField,
    TaskManifest,
    Type,
)

CORE_DIR = Path(__file__).parent / "core"
SIMULATORS_DIR = Path(__file__).parent / "simulators"

#: Load order of the core plugins — and so the order the catalogue lists task types in.
CORE_PLUGINS = ("pure", "graph_read", "ingest", "graph_write", "schema_write", "llm", "work_write")

#: The simulator plugins, loaded after the core ones.
SIMULATOR_PLUGINS = ("genomic",)

#: What every simulator task type takes and returns — the contract Invana runs it under.
SIMULATOR_ARGS = {"spec": Type.obj, "inputs": Type.list_, "seed": Type.int_}
SIMULATOR_OUTPUTS = {"ranked": Type.list_, "summary": Type.obj}


class PluginError(RuntimeError):
    """A plugin's manifests and code disagree; the message names the file."""


def engine_version() -> str:
    try:
        return importlib.metadata.version("invana-engine")
    except importlib.metadata.PackageNotFoundError:
        return "0.0.0"


@dataclass(frozen=True, slots=True)
class LoadedPlugin:
    manifest: PluginManifest
    tasks: tuple[TaskManifest, ...]
    flows: tuple[FlowManifest, ...]


@dataclass(frozen=True, slots=True)
class Simulator:
    """One installed simulator: its plugin, its task type, and the flow that runs it."""

    plugin: PluginManifest
    task: TaskManifest
    flow: FlowManifest

    @property
    def key(self) -> str:
        return self.task.key

    @property
    def handle(self) -> str:
        """The plugin's short name — ``genomic`` for ``invana.simulators.genomic``."""
        return self.plugin.name.rsplit(".", 1)[-1]


class Registry:
    """Plugins → task types (by ``key`` and ``key@version``) and flows; read-only once built."""

    __slots__ = ("_by_ref", "flows", "plugins", "simulators", "tasks")

    def __init__(self, plugins: tuple[LoadedPlugin, ...]) -> None:
        tasks: dict[str, TaskManifest] = {}
        by_ref: dict[str, TaskManifest] = {}
        flows: dict[str, FlowManifest] = {}
        for plugin in plugins:
            for task in plugin.tasks:
                if task.key in tasks:
                    raise PluginError(f"{plugin.manifest.name}: task type '{task.key}' is already declared")
                tasks[task.key] = task
                by_ref[task.ref] = task
            for flow in plugin.flows:
                if flow.key in flows:
                    raise PluginError(f"{plugin.manifest.name}: flow '{flow.key}' is already declared")
                flows[flow.key] = flow
        #: Every plugin, by name.
        self.plugins: Mapping[str, LoadedPlugin] = MappingProxyType({p.manifest.name: p for p in plugins})
        #: The current version of every task type, by key — the closed set a plan may name.
        self.tasks: Mapping[str, TaskManifest] = MappingProxyType(tasks)
        #: Every packaged flow, by key.
        self.flows: Mapping[str, FlowManifest] = MappingProxyType(flows)
        self._by_ref: Mapping[str, TaskManifest] = MappingProxyType(by_ref)
        #: Every installed simulator, by its task type's key.
        self.simulators: Mapping[str, Simulator] = MappingProxyType(
            {
                p.tasks[0].key: Simulator(plugin=p.manifest, task=p.tasks[0], flow=p.flows[0])
                for p in plugins
                if p.manifest.kind == "simulator"
            }
        )

    def task(self, ref: str) -> TaskManifest | None:
        """A task type by ``key`` or by ``key@version``; None when it is not loaded."""
        return self._by_ref.get(ref) if "@" in ref else self.tasks.get(ref)

    def simulator(self, ref: str) -> Simulator | None:
        """A simulator by key, ``key@version`` or its plugin's short name; None when none is installed."""
        key, _, version = ref.partition("@")
        found = self.simulators.get(key) or next((s for s in self.simulators.values() if s.handle == key), None)
        if found is None or (version and found.task.version != version):
            return None
        return found

    def versions(self) -> dict[str, str]:
        """``{key: version}`` for every task type — what a plan's rows record."""
        return {key: task.version for key, task in self.tasks.items()}


def _read(path: Path) -> dict:
    try:
        return tomllib.loads(path.read_text())
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise PluginError(f"{path}: {exc}") from exc


def _task(plugin: PluginManifest, package: str, folder: Path) -> TaskManifest:
    path = folder / "manifest.toml"
    data = _read(path)
    if str(data.get("key", "")).rsplit(".", 1)[-1] != folder.name:
        raise PluginError(f"{path}: key '{data.get('key')}' does not end in its folder '{folder.name}'")
    module = importlib.import_module(f"{package}.tasks.{folder.name}.run")
    run = getattr(module, "run", None)
    if not inspect.iscoroutinefunction(run) or len(inspect.signature(run).parameters) != 2:
        raise PluginError(f"{folder / 'run.py'}: needs `async def run(ctx, v) -> Out`")
    try:
        return TaskManifest(
            key=data["key"],
            version=str(data["version"]),
            summary=data.get("summary", ""),
            bound=Bound(data["bound"]),
            run=run,
            side_effect=SideEffect(data.get("side_effect", "read")),
            args={
                name: Arg(Type(spec["type"]), bool(spec.get("required", False)), spec.get("default"))
                for name, spec in data.get("args", {}).items()
            },
            outputs={name: Type(t) for name, t in data.get("outputs", {}).items()},
            requires=tuple(data.get("requires", ())),
            resources=tuple(Resource(r) for r in data.get("resources", ("cpu",))),
            timeout_s=data.get("timeout_s"),
            retries=data.get("retries"),
            plugin=plugin.name,
            spec={
                name: SpecField(
                    Type(f["type"]), bool(f.get("required", False)), f.get("default"), str(f.get("label", ""))
                )
                for name, f in data.get("spec", {}).items()
            },
        )
    except (KeyError, ValueError) as exc:
        raise PluginError(f"{path}: {exc!r}") from exc


def _flow(plugin: PluginManifest, path: Path) -> FlowManifest:
    data = _read(path)
    if data.get("key") != path.stem:
        raise PluginError(f"{path}: key '{data.get('key')}' is not its file name")
    try:
        return FlowManifest(
            key=data["key"],
            version=int(data["version"]),
            kind=data.get("kind", "ask"),
            description=data.get("description", ""),
            intents=tuple(data.get("intents", ())),
            tags=tuple(data.get("tags", ())),
            args_schema=data.get("args_schema", {}),
            steps=tuple(
                {"id": s["id"], "task": s["task"], "label": s["label"], "args": dict(s.get("args", {}))}
                for s in data.get("steps", ())
            ),
            plugin=plugin.name,
        )
    except (KeyError, ValueError) as exc:
        raise PluginError(f"{path}: {exc!r}") from exc


def load_plugin(folder: Path, package: str) -> LoadedPlugin:
    """Read one plugin folder; every task and flow on disk must be listed in its ``plugin.toml``."""
    path = folder / "plugin.toml"
    data = _read(path)
    kind = data.get("kind", "")
    version = engine_version() if kind == "core" else str(data.get("version", ""))
    if not version:
        raise PluginError(f"{path}: a {kind or 'plugin'} plugin declares its version")
    manifest = PluginManifest(
        name=data.get("name", ""),
        version=version,
        kind=kind,
        engine=data.get("engine", "*"),
        extra=data.get("extra", ""),
        secrets=tuple(data.get("secrets", ())),
        title=data.get("title", ""),
    )
    tasks, flows = list(data.get("tasks", ())), list(data.get("flows", ()))
    on_disk = {p.parent.name for p in (folder / "tasks").glob("*/manifest.toml")}
    if {t.rsplit(".", 1)[-1] for t in tasks} != on_disk:
        raise PluginError(f"{path}: `tasks` lists {sorted(tasks)}, the folder holds {sorted(on_disk)}")
    on_disk = {p.stem for p in (folder / "flows").glob("*.toml")}
    if set(flows) != on_disk:
        raise PluginError(f"{path}: `flows` lists {sorted(flows)}, the folder holds {sorted(on_disk)}")
    loaded = LoadedPlugin(
        manifest=manifest,
        tasks=tuple(_task(manifest, package, folder / "tasks" / key.rsplit(".", 1)[-1]) for key in tasks),
        flows=tuple(_flow(manifest, folder / "flows" / f"{key}.toml") for key in flows),
    )
    if kind == "simulator":
        _check_simulator(loaded, path)
    return loaded


def _check_simulator(plugin: LoadedPlugin, path: Path) -> None:
    """Hold a simulator plugin to its contract: one task type that takes a spec,
    pinned inputs and a seed and returns ranked rows and a summary, spends no
    bound, writes nothing, and one ``simulate`` flow whose single step runs it."""
    if len(plugin.tasks) != 1 or len(plugin.flows) != 1:
        raise PluginError(f"{path}: a simulator plugin declares exactly one task type and one flow")
    task, flow = plugin.tasks[0], plugin.flows[0]
    if task.bound is not Bound.none or task.side_effect is not SideEffect.read:
        raise PluginError(f"{path}: simulator '{task.key}' must be bound 'none' and side_effect 'read'")
    for name, wanted in SIMULATOR_ARGS.items():
        arg = task.args.get(name)
        if arg is None or arg.type is not wanted or not arg.required:
            raise PluginError(f"{path}: simulator '{task.key}' must take a required `{name}: {wanted}`")
    for name, wanted in SIMULATOR_OUTPUTS.items():
        if task.outputs.get(name) is not wanted:
            raise PluginError(f"{path}: simulator '{task.key}' must declare the output `{name}: {wanted}`")
    if flow.kind != "simulate" or [s["task"] for s in flow.steps] != [task.key]:
        raise PluginError(f"{path}: flow '{flow.key}' must be kind 'simulate' with one step running '{task.key}'")


def build_registry() -> Registry:
    """Every core plugin in load order, then every simulator. Tool plugins join here when they ship."""
    core = tuple(load_plugin(CORE_DIR / name, f"invana.plugins.core.{name}") for name in CORE_PLUGINS)
    simulators = tuple(
        load_plugin(SIMULATORS_DIR / name, f"invana.plugins.simulators.{name}") for name in SIMULATOR_PLUGINS
    )
    return Registry(core + simulators)
