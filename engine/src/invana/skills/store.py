"""DB access layer for ``skills`` rows."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.skills.models import Skill


class SkillStore:
    async def list_for_graph(self, session: AsyncSession, graph_id: str) -> list[Skill]:
        stmt = select(Skill).where(Skill.graph_id == graph_id).order_by(Skill.name)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, skill_id: str) -> Skill | None:
        stmt = select(Skill).where(Skill.id == skill_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, skill: Skill) -> Skill:
        session.add(skill)
        await session.flush()
        return skill

    async def delete(self, session: AsyncSession, skill: Skill) -> None:
        await session.delete(skill)
