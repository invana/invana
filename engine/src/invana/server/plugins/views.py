"""HTTP views for the plugin registry.

docs/for-developers/modules/platform/features/tool-plugins.md and
docs/for-developers/modules/platform/features/mcp-plugins.md. Any signed-in
user reads the registry; enabling, disabling and adding or refreshing an MCP
server are an install Admin's, and the manager decides that — a view parses,
calls ``PluginManager`` or ``McpManager`` and returns.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.runtime.managers import McpManager, PluginManager
from invana.runtime.schemas import (
    PLUGIN_LIST,
    McpServerAdd,
    McpServerRead,
    PluginDetail,
    PluginSummary,
    TaskTypeRead,
)

plugins = PluginManager()
mcp = McpManager()


async def list_plugins(
    params: ListParams = Depends(list_params(PLUGIN_LIST)),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Page[PluginSummary]:
    items, info = await plugins.page(session, params=params)
    return Page[PluginSummary].of(items, info, applied_filters(params, PLUGIN_LIST))


async def get_plugin(
    name: str,
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PluginDetail:
    return await plugins.show(session, name)


async def enable_plugin(
    name: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PluginSummary:
    return await plugins.switch(session, name=name, enabled=True, actor=user)


async def disable_plugin(
    name: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PluginSummary:
    return await plugins.switch(session, name=name, enabled=False, actor=user)


async def get_task_type(
    ref: str,
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskTypeRead:
    return await plugins.task_type(session, ref)


async def add_mcp_server(
    body: McpServerAdd,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> McpServerRead:
    return await mcp.add(session, name=body.name, url=body.url, actor=user)


async def refresh_mcp_server(
    name: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> McpServerRead:
    return await mcp.refresh(session, name=name, actor=user)
