"""Queries against ``project_assignments``."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import ProjectAssignment


class ProjectAssignmentQuerySet:
    async def list_for_project(self, session: AsyncSession, *, project_id: str) -> list[ProjectAssignment]:
        stmt = (
            select(ProjectAssignment)
            .where(ProjectAssignment.project_id == project_id)
            .order_by(ProjectAssignment.assigned_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, assignment_id: str) -> ProjectAssignment | None:
        return await session.get(ProjectAssignment, assignment_id)

    async def find(
        self, session: AsyncSession, *, project_id: str, principal_kind: str, principal_id: str
    ) -> ProjectAssignment | None:
        stmt = select(ProjectAssignment).where(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.principal_kind == principal_kind,
            ProjectAssignment.principal_id == principal_id,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, row: ProjectAssignment) -> ProjectAssignment:
        session.add(row)
        await session.flush()
        return row

    async def delete(self, session: AsyncSession, row: ProjectAssignment) -> None:
        await session.delete(row)
