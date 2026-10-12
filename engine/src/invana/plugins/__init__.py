"""Plugins — where every task type the runtime can run is declared
(docs/for-developers/modules/platform/features/plugins.md).

| Package | Holds |
|---|---|
| ``sdk`` | what a task type imports: its manifest types, ``TaskContext``, the errors it may raise |
| ``registry`` | the loader and the frozen :class:`~invana.plugins.registry.Registry` |
| ``core`` | the core plugins, always loaded and versioned with the engine |

The registry is built **once per process** by :func:`load_plugins` and never
changes afterwards. Task type keys are the plan vocabulary — stored in
``run_nodes.task_key`` and read by Studio — so moving a task type between
plugins never renames it.

``invana.plugins`` shares the runtime's band: task bodies use the runtime's
stream and governor, and the runtime dispatches task types, so neither sits
above the other. ``apps`` imports neither.
"""

from __future__ import annotations

from functools import cache

from invana.plugins.registry import LoadedPlugin, PluginError, Registry, build_registry

#: The ``mcp`` plugins this process installed at start-up; empty until then.
_mcp: tuple[LoadedPlugin, ...] = ()


@cache
def load_plugins() -> Registry:
    """The frozen registry of this process, built on first call."""
    return build_registry(_mcp)


def install_mcp(plugins: tuple[LoadedPlugin, ...]) -> Registry:
    """Add the MCP plugins read from the app DB; called once, at start-up, before any plan runs.

    Rebuilds the registry with them appended and returns it. Calling it again
    replaces the MCP set rather than adding to it, so a start-up path that runs
    twice (a test app, a CLI command inside another) lands on the same registry.
    """
    global _mcp  # noqa: PLW0603 — set once at start-up, read by every later build
    _mcp = tuple(plugins)
    load_plugins.cache_clear()
    return load_plugins()


__all__ = ["PluginError", "Registry", "install_mcp", "load_plugins"]
