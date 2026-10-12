"""Queries against ``standards`` and ``standard_versions``.

A queryset answers *which rows*, never *whether* — who may mint a version is
the manager's rule.
"""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.standards.models import Standard, StandardVersion


class StandardQuerySet:
    async def get(self, session: AsyncSession, standard_id: str) -> Standard | None:
        return await session.get(Standard, standard_id)

    async def get_by_address(self, session: AsyncSession, *, publisher: str, name: str) -> Standard | None:
        stmt = select(Standard).where(Standard.publisher == publisher, Standard.name == name)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def search(
        self, session: AsyncSession, *, origin: str | None = None, text: str | None = None
    ) -> list[Standard]:
        """Every standard, by address."""
        stmt = select(Standard)
        if origin:
            stmt = stmt.where(Standard.origin == origin)
        if text:
            like = f"%{text.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Standard.name).like(like),
                    func.lower(Standard.title).like(like),
                    func.lower(Standard.description).like(like),
                )
            )
        return list((await session.execute(stmt.order_by(Standard.publisher, Standard.name))).scalars().all())

    async def add(self, session: AsyncSession, standard: Standard) -> Standard:
        session.add(standard)
        await session.flush()
        return standard


class StandardVersionQuerySet:
    async def get(self, session: AsyncSession, version_id: str) -> StandardVersion | None:
        return await session.get(StandardVersion, version_id)

    async def get_by_number(self, session: AsyncSession, standard_id: str, version: int) -> StandardVersion | None:
        stmt = select(StandardVersion).where(
            StandardVersion.standard_id == standard_id, StandardVersion.version == version
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_for_standard(self, session: AsyncSession, standard_id: str) -> list[StandardVersion]:
        """Newest first."""
        stmt = (
            select(StandardVersion)
            .where(StandardVersion.standard_id == standard_id)
            .order_by(StandardVersion.version.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    async def highest_version(self, session: AsyncSession, standard_id: str) -> int:
        stmt = select(func.max(StandardVersion.version)).where(StandardVersion.standard_id == standard_id)
        return (await session.execute(stmt)).scalar_one_or_none() or 0

    async def add(self, session: AsyncSession, version: StandardVersion) -> StandardVersion:
        session.add(version)
        await session.flush()
        return version
