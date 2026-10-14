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
| ``skills/<slug>/`` | ``skill.toml`` + ``instructions.md`` — :class:`~invana.plugins.sdk.manifest.SkillManifest` |

Every check is made at load, and a failure raises :class:`PluginError` naming
the file, so a manifest that drifted from its code stops the process at start
rather than a plan at run time. A core plugin's version is the engine's, and a
task key's last dotted segment is its folder (``sim.genomic_prediction`` →
``tasks/genomic_prediction/``) — or, where two keys of one plugin end alike, the
whole key with dots as underscores (``uniprot.get`` → ``tasks/uniprot_get/``).

Three kinds load: the **core** plugins, always; the **simulator** plugins
under ``simulators/`` (docs/for-developers/modules/work/features/simulation.md);
and the **tool** plugins under ``tools/``, each only when its extra is
installed (docs/for-developers/modules/platform/features/tool-plugins.md). A
tool plugin whose extra is missing is kept in :attr:`Registry.missing` — its
manifest only, so the registry can say what would install it. Whether an
installed tool plugin is *enabled* is not the registry's business: that is a
gate checked at dispatch, and the loaded set stays closed.
A fourth kind, **mcp**, is not on disk: each MCP server an Admin added is
stored in the app DB and handed to :func:`build_registry` once at start-up
(docs/for-developers/modules/platform/features/mcp-plugins.md).
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
import re
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
    SkillManifest,
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

TOOLS_DIR = Path(__file__).parent / "tools"

#: The tool plugins, loaded last and only when their extra is installed.
TOOL_PLUGINS = ("web", "mail", "science")

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


def extra_installed(extra: str) -> bool:
    """Whether every requirement the engine's ``extra`` names is installed.

    Read from the engine's own metadata, so the rule is the one pip applied. An
    extra with no third-party requirement is always installed, and so is any
    extra when the engine runs from a source tree with no metadata.
    """
    if not extra:
        return True
    try:
        requires = importlib.metadata.requires("invana-engine") or []
    except importlib.metadata.PackageNotFoundError:
        return True
    marker = re.compile(r"extra\s*==\s*[\"']" + re.escape(extra) + r"[\"']")
    for req in requires:
        spec, _, markers = req.partition(";")
        name = re.match(r"[A-Za-z0-9_.-]+", spec.strip())
        if not marker.search(markers) or name is None or name.group(0) == "invana-engine":
            continue
        try:
            importlib.metadata.distribution(name.group(0))
        except importlib.metadata.PackageNotFoundError:
            return False
    return True


@dataclass(frozen=True, slots=True)
class LoadedPlugin:
    manifest: PluginManifest
    tasks: tuple[TaskManifest, ...]
    flows: tuple[FlowManifest, ...]
    skills: tuple[SkillManifest, ...] = ()


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

    __slots__ = ("_by_ref", "flows", "missing", "plugins", "simulators", "tasks")

    def __init__(self, plugins: tuple[LoadedPlugin, ...], missing: tuple[PluginManifest, ...] = ()) -> None:
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
        #: Tool plugins on disk whose extra is not installed — manifest only, nothing loaded.
        self.missing: Mapping[str, PluginManifest] = MappingProxyType({m.name: m for m in missing})
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


def _folders(key: str) -> tuple[str, str]:
    """The two folder names a key may live in: its last segment, or the whole key with underscores."""
    return key.rsplit(".", 1)[-1], key.replace(".", "_")


def _task_folder(tasks_dir: Path, key: str) -> Path:
    last, whole = _folders(key)
    return tasks_dir / whole if (tasks_dir / whole).is_dir() else tasks_dir / last


def _task(plugin: PluginManifest, package: str, folder: Path) -> TaskManifest:
    path = folder / "manifest.toml"
    data = _read(path)
    if folder.name not in _folders(str(data.get("key", ""))):
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


def _skill(plugin: PluginManifest, folder: Path) -> SkillManifest:
    path = folder / "skill.toml"
    data = _read(path)
    try:
        instructions = (folder / "instructions.md").read_text()
    except OSError as exc:
        raise PluginError(f"{folder / 'instructions.md'}: {exc}") from exc
    try:
        return SkillManifest(
            slug=folder.name,
            name=data["name"],
            version=int(data.get("version", 1)),
            when_to_use=data.get("when_to_use", ""),
            description=data.get("description", ""),
            instructions=instructions,
            plugin=plugin.name,
        )
    except (KeyError, ValueError) as exc:
        raise PluginError(f"{path}: {exc!r}") from exc


def read_manifest(folder: Path) -> PluginManifest:
    """A plugin's ``plugin.toml`` alone — nothing imported, so it reads even when its extra is missing."""
    path = folder / "plugin.toml"
    data = _read(path)
    kind = data.get("kind", "")
    version = engine_version() if kind == "core" else str(data.get("version", ""))
    if not version:
        raise PluginError(f"{path}: a {kind or 'plugin'} plugin declares its version")
    return PluginManifest(
        name=data.get("name", ""),
        version=version,
        kind=kind,
        engine=data.get("engine", "*"),
        extra=data.get("extra", ""),
        secrets=tuple(data.get("secrets", ())),
        title=data.get("title", ""),
    )


def load_plugin(folder: Path, package: str) -> LoadedPlugin:
    """Read one plugin folder; every task, flow and skill on disk must be listed in its ``plugin.toml``."""
    path = folder / "plugin.toml"
    data = _read(path)
    manifest = read_manifest(folder)
    tasks, flows, skills = list(data.get("tasks", ())), list(data.get("flows", ())), list(data.get("skills", ()))
    on_disk = {p.parent.name for p in (folder / "tasks").glob("*/manifest.toml")}
    if {_task_folder(folder / "tasks", t).name for t in tasks} != on_disk:
        raise PluginError(f"{path}: `tasks` lists {sorted(tasks)}, the folder holds {sorted(on_disk)}")
    on_disk = {p.stem for p in (folder / "flows").glob("*.toml")}
    if set(flows) != on_disk:
        raise PluginError(f"{path}: `flows` lists {sorted(flows)}, the folder holds {sorted(on_disk)}")
    on_disk = {p.parent.name for p in (folder / "skills").glob("*/skill.toml")}
    if set(skills) != on_disk:
        raise PluginError(f"{path}: `skills` lists {sorted(skills)}, the folder holds {sorted(on_disk)}")
    loaded = LoadedPlugin(
        manifest=manifest,
        tasks=tuple(_task(manifest, package, _task_folder(folder / "tasks", key)) for key in tasks),
        flows=tuple(_flow(manifest, folder / "flows" / f"{key}.toml") for key in flows),
        skills=tuple(_skill(manifest, folder / "skills" / slug) for slug in skills),
    )
    if manifest.kind == "simulator":
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


def build_registry(mcp: tuple[LoadedPlugin, ...] = ()) -> Registry:
    """Every core plugin in load order, then every simulator, then every tool plugin whose extra is
    installed, then the ``mcp`` plugins read from the app DB at start-up."""
    core = tuple(load_plugin(CORE_DIR / name, f"invana.plugins.core.{name}") for name in CORE_PLUGINS)
    simulators = tuple(
        load_plugin(SIMULATORS_DIR / name, f"invana.plugins.simulators.{name}") for name in SIMULATOR_PLUGINS
    )
    tools: list[LoadedPlugin] = []
    missing: list[PluginManifest] = []
    for name in TOOL_PLUGINS:
        manifest = read_manifest(TOOLS_DIR / name)
        if manifest.kind != "tool":
            raise PluginError(f"{TOOLS_DIR / name / 'plugin.toml'}: a plugin under tools/ is kind 'tool'")
        if extra_installed(manifest.extra):
            tools.append(load_plugin(TOOLS_DIR / name, f"invana.plugins.tools.{name}"))
        else:
            missing.append(manifest)
    if any(p.manifest.kind != "mcp" for p in mcp):
        raise PluginError("only mcp plugins are installed from the app DB")
    return Registry(core + simulators + tuple(tools) + mcp, tuple(missing))
