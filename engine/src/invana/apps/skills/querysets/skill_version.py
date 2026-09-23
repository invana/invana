"""Queries against ``skill_versions``.

A queryset answers *which rows*, never *whether* — no permission check, no
HTTP type, no event. Stateless: the session is the first argument of every
method (migration-plan §5).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill, SkillVersion


class SkillVersionQuerySet:
    async def list_for_skill(
        self, session: AsyncSession, skill_id: str, *, include_draft: bool = False
    ) -> list[SkillVersion]:
        """Newest first — the version bar reads down from the head.

        **Published only by default.** A draft is a version row with no
        ``published_at`` ([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
        and every existing reader — the version bar, usage, the diff — is asking
        about text that was offered to something. Only the authoring surface
        wants the draft, and it asks for it by name.
        """
        stmt = select(SkillVersion).where(SkillVersion.skill_id == skill_id)
        if not include_draft:
            stmt = stmt.where(SkillVersion.published_at.is_not(None))
        return list((await session.execute(stmt.order_by(SkillVersion.version.desc()))).scalars().all())

    async def get_draft(self, session: AsyncSession, skill_id: str) -> SkillVersion | None:
        """The one unpublished row, if there is one. A skill has at most one."""
        stmt = select(SkillVersion).where(SkillVersion.skill_id == skill_id, SkillVersion.published_at.is_(None))
        return (await session.execute(stmt)).scalars().first()

    async def drafts_for_skills(self, session: AsyncSession, skill_ids: list[str]) -> dict[str, SkillVersion]:
        """``{skill_id: draft}`` for a whole drawer in one query — a row per
        skill would be a query per row."""
        if not skill_ids:
            return {}
        stmt = select(SkillVersion).where(SkillVersion.skill_id.in_(skill_ids), SkillVersion.published_at.is_(None))
        return {row.skill_id: row for row in (await session.execute(stmt)).scalars().all()}

    async def owners_for_plans(self, session: AsyncSession, plan_ids: list[str]) -> dict[str, tuple[str, str, int]]:
        """``{plan_id: (skill_id, skill name, version number)}`` — who owns each plan.

        One version owns exactly one plan
        ([SK13](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
        so this is the inverse of that relation, asked for a whole list at once
        because a caller list of N would otherwise be N queries.
        """
        if not plan_ids:
            return {}
        stmt = (
            select(SkillVersion.plan_id, SkillVersion.skill_id, Skill.name, SkillVersion.version)
            .join(Skill, Skill.id == SkillVersion.skill_id)
            .where(SkillVersion.plan_id.in_(plan_ids))
        )
        return {
            plan_id: (skill_id, name, version)
            for plan_id, skill_id, name, version in (await session.execute(stmt)).all()
        }

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
