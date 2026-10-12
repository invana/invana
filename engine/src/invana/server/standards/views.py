"""HTTP handlers for standards — install-wide, so no Graph in the path.

Parse, call ``StandardManager``, serialise. Every signed-in user reads every
standard; who may mint a version, and who may create a pack, is the manager's.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.standards.managers import StandardManager
from invana.apps.standards.schemas import (
    StandardCreate,
    StandardListResponse,
    StandardRead,
    StandardVersionCreate,
    StandardVersionListResponse,
    StandardVersionRead,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session

standards = StandardManager()


async def list_standards(
    origin: str | None = Query(default=None, description="pack or authored."),
    q: str | None = Query(default=None, description="Text in the name, title or description."),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StandardListResponse:
    """The library: every standard in the install, by address."""
    items = [await standards.read(session, s) for s in await standards.search(session, origin=origin, text=q)]
    return StandardListResponse(items=items, total=len(items))


async def create_standard(
    payload: StandardCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StandardRead:
    """A standard, and its v1 when the body carries terms."""
    return await standards.read(session, await standards.create(session, payload=payload, actor=user))


async def get_standard(
    publisher: str = Path(...),
    name: str = Path(...),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StandardRead:
    return await standards.read(session, await standards.get(session, publisher=publisher, name=name))


async def list_versions(
    publisher: str = Path(...),
    name: str = Path(...),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StandardVersionListResponse:
    standard = await standards.get(session, publisher=publisher, name=name)
    items = [standards.read_version(standard, v) for v in await standards.list_versions(session, standard=standard)]
    return StandardVersionListResponse(items=items, total=len(items))


async def publish_version(
    payload: StandardVersionCreate,
    publisher: str = Path(...),
    name: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StandardVersionRead:
    """The next immutable version. Datasets that claim an earlier one keep it."""
    standard = await standards.get(session, publisher=publisher, name=name)
    version = await standards.publish_version(
        session, standard=standard, terms=payload.terms, why=payload.why, actor=user
    )
    return standards.read_version(standard, version)


async def get_version(
    publisher: str = Path(...),
    name: str = Path(...),
    version: int = Path(..., ge=1),
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StandardVersionRead:
    standard = await standards.get(session, publisher=publisher, name=name)
    return standards.read_version(standard, await standards.get_version(session, standard=standard, version=version))
