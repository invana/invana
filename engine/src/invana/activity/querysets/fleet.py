"""Queries behind the fleet reads — the Agents Overview, Performance and pins.

Two reads no app's queryset already answers: every root of a Graph since a
time, and every published skill version of a Graph. Everything else the fleet
reads comes from the querysets that own those tables.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill, SkillVersion
from invana.runtime.models import RunRole, TaskRun


class FleetQuerySet:
    async def roots_since(self, session: AsyncSession, *, graph_id: str, since: datetime) -> list[TaskRun]:
        """The Graph's roots queued since ``since``, oldest first.

        Eval runs are left out: they draw on the Graph's eval budget and are
        shown apart, the way the agent meters count.
        """
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.graph_id == graph_id,
                TaskRun.parent_run_id.is_(None),
                TaskRun.role != RunRole.evaluate.value,
                TaskRun.queued_at >= since,
            )
            .order_by(TaskRun.queued_at, TaskRun.id)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def published_skill_versions(self, session: AsyncSession, *, graph_id: str) -> list[SkillVersion]:
        """Every published version of every skill in the Graph, oldest first."""
        stmt = (
            select(SkillVersion)
            .join(Skill, Skill.id == SkillVersion.skill_id)
            .where(Skill.graph_id == graph_id, SkillVersion.published_at.is_not(None))
            .order_by(SkillVersion.published_at, SkillVersion.version)
        )
        return list((await session.execute(stmt)).scalars().all())
