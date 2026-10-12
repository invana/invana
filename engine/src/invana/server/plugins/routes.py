"""Paths for the plugin registry — ``/api/v1/plugins`` and ``/api/v1/task-types``.

docs/for-developers/modules/platform/features/tool-plugins.md. Install-level,
not Graph-scoped: the registry is the process's, the same for every Graph.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.runtime.schemas import PluginDetail, PluginListResponse, PluginSummary, TaskTypeRead
from invana.server.plugins import views

plugins_router = APIRouter(prefix="/api/v1/plugins", tags=["plugins"])

plugins_router.get("", response_model=PluginListResponse)(views.list_plugins)
plugins_router.get("/{name}", response_model=PluginDetail)(views.get_plugin)
plugins_router.post("/{name}/enable", response_model=PluginSummary)(views.enable_plugin)
plugins_router.post("/{name}/disable", response_model=PluginSummary)(views.disable_plugin)

task_types_router = APIRouter(prefix="/api/v1/task-types", tags=["plugins"])

task_types_router.get("/{ref}", response_model=TaskTypeRead)(views.get_task_type)

__all__ = ["plugins_router", "task_types_router"]
