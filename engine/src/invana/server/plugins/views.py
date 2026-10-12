"""HTTP views for the plugin registry.

docs/for-developers/modules/platform/features/tool-plugins.md. Any signed-in
user reads the registry; enabling or disabling is an install Admin's, and the
manager decides that — a view parses, calls ``PluginManager`` and returns.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime.managers import PluginManager
from invana.runtime.schemas import PluginDetail, PluginListResponse, PluginSummary, TaskTypeRead

plugins = PluginManager()


async def list_plugins(
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PluginListResponse:
    items = await plugins.list(session)
    return PluginListResponse(items=items, total=len(items))


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
