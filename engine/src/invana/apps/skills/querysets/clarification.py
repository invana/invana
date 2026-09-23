"""Queries against ``skill_version_clarifications``.

What the planner asked about one sentence, and what the author answered. A
queryset answers *which rows*, never *whether* (migration-plan §5).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import SkillVersionClarification


class SkillClarificationQuerySet:
    async def list_for_version(self, session: AsyncSession, version_id: str) -> list[SkillVersionClarification]:
        """Oldest first — they were asked in the order the prose reads."""
        stmt = (
            select(SkillVersionClarification)
            .where(SkillVersionClarification.skill_version_id == version_id)
            .order_by(SkillVersionClarification.created_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def open_for_version(self, session: AsyncSession, version_id: str) -> SkillVersionClarification | None:
        """The unanswered one. There is at most one: the planner stops at the
        first ambiguity rather than collecting a queue
        ([SK24](docs/for-developers/modules/skills/features/authoring-a-skill.md))."""
        stmt = (
            select(SkillVersionClarification)
            .where(
                SkillVersionClarification.skill_version_id == version_id,
                SkillVersionClarification.answer.is_(None),
            )
            .order_by(SkillVersionClarification.created_at)
        )
        return (await session.execute(stmt)).scalars().first()

    async def get(self, session: AsyncSession, clarification_id: str) -> SkillVersionClarification | None:
        stmt = select(SkillVersionClarification).where(SkillVersionClarification.id == clarification_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, row: SkillVersionClarification) -> SkillVersionClarification:
        session.add(row)
        await session.flush()
        return row

    async def answered_spans(self, session: AsyncSession, version_id: str) -> dict[str, str]:
        """``{span: answer}`` — what a redraw must not ask again (SK11)."""
        rows = await self.list_for_version(session, version_id)
        return {r.span: r.answer for r in rows if r.answer is not None}
