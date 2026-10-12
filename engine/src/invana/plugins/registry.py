"""The registry — every plugin loaded in this process, its task types and its flows.

Built once from the manifests on disk and then **frozen**: nothing registers a
task type while plans run, which is what keeps the envelope enforceable
(docs/for-developers/orchestration.md §0.6).

A plugin is a folder:

| Path | Holds |
|---|---|
| ``plugin.toml`` | ``name · kind · engine · extra · secrets`` and the ordered ``tasks`` and ``flows`` |
| ``tasks/<key>/manifest.toml`` | the task manifest — :class:`~invana.plugins.sdk.manifest.TaskManifest` |
| ``tasks/<key>/run.py`` | ``async def run(ctx, v) -> Out`` |
| ``flows/<key>.toml`` | a packaged flow — :class:`~invana.plugins.sdk.manifest.FlowManifest` |

Every check is made at load, and a failure raises :class:`PluginError` naming
the file, so a manifest that drifted from its code stops the process at start
rather than a plan at run time. A core plugin's version is the engine's.

Usage::

    from invana.plugins import load_plugins

    registry = load_plugins()
    registry.task("execute_graph_query")        # latest version of a key
    registry.task("execute_graph_query@1.0.0")  # one exact version
    registry.flows["model-import"]
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
    TaskManifest,
    Type,
)

CORE_DIR = Path(__file__).parent / "core"

#: Load order of the core plugins — and so the order the catalogue lists task types in.
CORE_PLUGINS = ("pure", "graph_read", "ingest", "graph_write", "schema_write", "llm", "work_write")


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


class Registry:
    """Plugins → task types (by ``key`` and ``key@version``) and flows; read-only once built."""

    __slots__ = ("_by_ref", "flows", "plugins", "tasks")

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

    def task(self, ref: str) -> TaskManifest | None:
        """A task type by ``key`` or by ``key@version``; None when it is not loaded."""
        return self._by_ref.get(ref) if "@" in ref else self.tasks.get(ref)

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
    if data.get("key") != folder.name:
        raise PluginError(f"{path}: key '{data.get('key')}' is not its folder '{folder.name}'")
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
    )
    tasks, flows = list(data.get("tasks", ())), list(data.get("flows", ()))
    on_disk = {p.parent.name for p in (folder / "tasks").glob("*/manifest.toml")}
    if set(tasks) != on_disk:
        raise PluginError(f"{path}: `tasks` lists {sorted(tasks)}, the folder holds {sorted(on_disk)}")
    on_disk = {p.stem for p in (folder / "flows").glob("*.toml")}
    if set(flows) != on_disk:
        raise PluginError(f"{path}: `flows` lists {sorted(flows)}, the folder holds {sorted(on_disk)}")
    return LoadedPlugin(
        manifest=manifest,
        tasks=tuple(_task(manifest, package, folder / "tasks" / key) for key in tasks),
        flows=tuple(_flow(manifest, folder / "flows" / f"{key}.toml") for key in flows),
    )


def build_registry() -> Registry:
    """Every core plugin, in load order. Tool plugins join here when they ship."""
    return Registry(tuple(load_plugin(CORE_DIR / name, f"invana.plugins.core.{name}") for name in CORE_PLUGINS))
