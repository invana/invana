"""Queries against ``skill_bindings``.

A queryset answers *which rows*, never *whether* — no permission check, no
HTTP type, no event. Stateless: the session is the first argument of every
method (migration-plan §5).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import SkillBinding


class SkillBindingQuerySet:
    async def get(self, session: AsyncSession, *, skill_id: str, agent_id: str) -> SkillBinding | None:
        stmt = select(SkillBinding).where(
            SkillBinding.skill_id == skill_id,
            SkillBinding.agent_id == agent_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def skill_ids_for_agent(self, session: AsyncSession, *, agent_id: str) -> list[str]:
        stmt = select(SkillBinding.skill_id).where(SkillBinding.agent_id == agent_id)
        return list((await session.execute(stmt)).scalars().all())

    async def agent_ids_for_skill(self, session: AsyncSession, *, skill_id: str) -> list[str]:
        stmt = select(SkillBinding.agent_id).where(SkillBinding.skill_id == skill_id)
        return list((await session.execute(stmt)).scalars().all())

    async def for_agent(self, session: AsyncSession, *, agent_id: str) -> list[SkillBinding]:
        stmt = select(SkillBinding).where(SkillBinding.agent_id == agent_id).order_by(SkillBinding.bound_at)
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, binding: SkillBinding) -> SkillBinding:
        session.add(binding)
        await session.flush()
        return binding

    async def delete(self, session: AsyncSession, binding: SkillBinding) -> None:
        await session.delete(binding)
