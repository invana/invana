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

from invana.plugins.registry import PluginError, Registry, build_registry


@cache
def load_plugins() -> Registry:
    """The frozen registry of this process, built on first call."""
    return build_registry()


__all__ = ["PluginError", "Registry", "load_plugins"]
