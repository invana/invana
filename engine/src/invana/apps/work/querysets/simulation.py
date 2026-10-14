"""Queries against ``project_simulations``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import ProjectSimulation


class ProjectSimulationQuerySet:
    async def next_number(self, session: AsyncSession, *, project_id: str) -> int:
        stmt = select(func.coalesce(func.max(ProjectSimulation.number), 0)).where(
            ProjectSimulation.project_id == project_id
        )
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def add(self, session: AsyncSession, row: ProjectSimulation) -> ProjectSimulation:
        session.add(row)
        await session.flush()
        return row

    async def get_by_number(self, session: AsyncSession, *, project_id: str, number: int) -> ProjectSimulation | None:
        stmt = select(ProjectSimulation).where(
            ProjectSimulation.project_id == project_id, ProjectSimulation.number == number
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def list_for_project(
        self, session: AsyncSession, *, project_id: str, branch_id: str | None = None
    ) -> list[ProjectSimulation]:
        """Newest first; narrowed to one branch when one is named."""
        stmt = select(ProjectSimulation).where(ProjectSimulation.project_id == project_id)
        if branch_id is not None:
            stmt = stmt.where(ProjectSimulation.branch_id == branch_id)
        stmt = stmt.order_by(ProjectSimulation.number.desc())
        return list((await session.execute(stmt)).scalars().all())
