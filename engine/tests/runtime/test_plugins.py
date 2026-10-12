"""The plugin registry: built from the manifests, frozen, and loud when a manifest drifts from its code."""

from __future__ import annotations

from pathlib import Path

import pytest

from invana.plugins import PluginError, load_plugins
from invana.plugins.registry import engine_version, load_plugin
from invana.runtime.catalogue import CATALOGUE

RUN = "async def run(ctx, v):\n    return None\n"


def _plugin(root: Path, name: str, *, key: str = "echo", folder: str = "echo", run: str = RUN) -> Path:
    plugin = root / name
    (plugin / "tasks" / folder).mkdir(parents=True)
    for d in (plugin, plugin / "tasks", plugin / "tasks" / folder):
        (d / "__init__.py").write_text("")
    (plugin / "plugin.toml").write_text(
        f'name = "test.{name}"\nkind = "tool"\nversion = "0.1.0"\ntasks = ["{folder}"]\n'
    )
    (plugin / "tasks" / folder / "manifest.toml").write_text(
        f'key = "{key}"\nversion = "2.1.0"\nsummary = "Echo."\nbound = "none"\n\n[outputs]\ntext = "str"\n'
    )
    (plugin / "tasks" / folder / "run.py").write_text(run)
    return plugin


class TestCorePlugins:
    def test_every_core_task_type_is_loaded_with_its_version_and_plugin(self) -> None:
        registry = load_plugins()
        assert set(registry.tasks) == set(CATALOGUE)
        task = registry.task("execute_graph_query")
        assert task is not None and task.plugin == "invana.core.graph_read"
        assert registry.task(f"execute_graph_query@{task.version}") is task
        assert registry.task("execute_graph_query@99.0.0") is None
        assert {p.manifest.version for p in registry.plugins.values()} == {engine_version()}

    def test_every_packaged_flow_names_loaded_task_types(self) -> None:
        registry = load_plugins()
        assert registry.flows["model-import"].ref == "model-import@1"
        for flow in registry.flows.values():
            assert all(step["task"] in registry.tasks for step in flow.steps), flow.key

    def test_the_registry_is_read_only(self) -> None:
        with pytest.raises(TypeError):
            load_plugins().tasks["anything"] = CATALOGUE["validate_query"]  # type: ignore[index]


class TestDrift:
    def test_a_well_formed_plugin_loads(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.syspath_prepend(str(tmp_path))
        loaded = load_plugin(_plugin(tmp_path, "good_plugin"), "good_plugin")
        assert [t.ref for t in loaded.tasks] == ["echo@2.1.0"]
        assert loaded.manifest.version == "0.1.0"

    def test_a_key_that_is_not_its_folder_names_the_manifest(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.syspath_prepend(str(tmp_path))
        with pytest.raises(PluginError, match=r"echo/manifest\.toml"):
            load_plugin(_plugin(tmp_path, "renamed_plugin", key="shout"), "renamed_plugin")

    def test_a_run_py_without_an_async_run_is_refused(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.syspath_prepend(str(tmp_path))
        with pytest.raises(PluginError, match=r"run\.py"):
            load_plugin(_plugin(tmp_path, "sync_plugin", run="def run(ctx, v):\n    return None\n"), "sync_plugin")

    def test_a_task_folder_the_plugin_does_not_list_is_refused(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.syspath_prepend(str(tmp_path))
        plugin = _plugin(tmp_path, "extra_plugin")
        (plugin / "tasks" / "stray").mkdir()
        (plugin / "tasks" / "stray" / "manifest.toml").write_text('key = "stray"\n')
        with pytest.raises(PluginError, match=r"plugin\.toml"):
            load_plugin(plugin, "extra_plugin")
