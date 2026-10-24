"""Paths for the plugin registry — ``/api/v1/plugins``.

docs/for-developers/modules/platform/features/tool-plugins.md and
docs/for-developers/modules/platform/features/mcp-plugins.md. Install-level,
not Graph-scoped: the registry is the process's, the same for every Graph.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.core.lists import Page
from invana.runtime.schemas import McpServerRead, PluginDetail, PluginSummary
from invana.server.plugins import views

plugins_router = APIRouter(prefix="/api/v1/plugins", tags=["plugins"])

plugins_router.get("", response_model=Page[PluginSummary])(views.list_plugins)
plugins_router.post("/mcp", response_model=McpServerRead, status_code=201)(views.add_mcp_server)
plugins_router.post("/mcp/{name}/refresh", response_model=McpServerRead)(views.refresh_mcp_server)
plugins_router.get("/{name}", response_model=PluginDetail)(views.get_plugin)
plugins_router.post("/{name}/enable", response_model=PluginSummary)(views.enable_plugin)
plugins_router.post("/{name}/disable", response_model=PluginSummary)(views.disable_plugin)

__all__ = ["plugins_router"]
