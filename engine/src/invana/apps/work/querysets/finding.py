"""Queries against ``project_findings``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import ProjectFinding


class ProjectFindingQuerySet:
    async def list_for_project(self, session: AsyncSession, *, project_id: str) -> list[ProjectFinding]:
        stmt = select(ProjectFinding).where(ProjectFinding.project_id == project_id).order_by(ProjectFinding.number)
        return list((await session.execute(stmt)).scalars().all())

    async def get_by_number(self, session: AsyncSession, *, project_id: str, number: int) -> ProjectFinding | None:
        stmt = select(ProjectFinding).where(ProjectFinding.project_id == project_id, ProjectFinding.number == number)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def by_ids(self, session: AsyncSession, ids: list[str]) -> list[ProjectFinding]:
        if not ids:
            return []
        stmt = select(ProjectFinding).where(ProjectFinding.id.in_(ids)).order_by(ProjectFinding.number)
        return list((await session.execute(stmt)).scalars().all())

    async def next_number(self, session: AsyncSession, *, project_id: str) -> int:
        stmt = select(func.coalesce(func.max(ProjectFinding.number), 0)).where(ProjectFinding.project_id == project_id)
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def review_counts(self, session: AsyncSession, *, project_id: str) -> tuple[int, int]:
        """A project's findings, and how many of them a person reviewed."""
        stmt = select(func.count(), func.count(ProjectFinding.reviewed_by_id)).where(
            ProjectFinding.project_id == project_id
        )
        total, reviewed = (await session.execute(stmt)).one()
        return int(total), int(reviewed)

    async def cites_for_project(self, session: AsyncSession, *, project_id: str) -> list[list]:
        """Every finding's cites, one list per finding."""
        stmt = select(ProjectFinding.cites).where(ProjectFinding.project_id == project_id)
        return [cites or [] for cites in (await session.execute(stmt)).scalars().all()]

    async def add(self, session: AsyncSession, finding: ProjectFinding) -> ProjectFinding:
        session.add(finding)
        await session.flush()
        return finding
