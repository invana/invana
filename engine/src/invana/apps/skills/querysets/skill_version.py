"""Queries against ``skill_versions``.

A queryset answers *which rows*, never *whether* — no permission check, no
HTTP type, no event. Stateless: the session is the first argument of every
method (migration-plan §5).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import SkillVersion


class SkillVersionQuerySet:
    async def list_for_skill(self, session: AsyncSession, skill_id: str) -> list[SkillVersion]:
        """Newest first — the version bar reads down from the head."""
        stmt = select(SkillVersion).where(SkillVersion.skill_id == skill_id).order_by(SkillVersion.version.desc())
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, version_id: str) -> SkillVersion | None:
        stmt = select(SkillVersion).where(SkillVersion.id == version_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_by_number(self, session: AsyncSession, skill_id: str, version: int) -> SkillVersion | None:
        stmt = select(SkillVersion).where(SkillVersion.skill_id == skill_id, SkillVersion.version == version)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def highest_version(self, session: AsyncSession, skill_id: str) -> int:
        """``0`` for a skill with no versions, so the next one is always ``+ 1``."""
        stmt = select(func.max(SkillVersion.version)).where(SkillVersion.skill_id == skill_id)
        return (await session.execute(stmt)).scalar_one_or_none() or 0

    async def add(self, session: AsyncSession, version: SkillVersion) -> SkillVersion:
        session.add(version)
        await session.flush()
        return version
