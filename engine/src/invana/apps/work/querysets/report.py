"""Queries against ``project_reports`` and ``project_report_versions``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import ProjectReport, ProjectReportVersion


class ProjectReportQuerySet:
    async def for_project(self, session: AsyncSession, *, project_id: str) -> ProjectReport | None:
        stmt = select(ProjectReport).where(ProjectReport.project_id == project_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def versions(self, session: AsyncSession, *, report_id: str) -> list[ProjectReportVersion]:
        stmt = (
            select(ProjectReportVersion)
            .where(ProjectReportVersion.report_id == report_id)
            .order_by(ProjectReportVersion.version)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def version(self, session: AsyncSession, *, report_id: str, version: int) -> ProjectReportVersion | None:
        stmt = select(ProjectReportVersion).where(
            ProjectReportVersion.report_id == report_id, ProjectReportVersion.version == version
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def next_version(self, session: AsyncSession, *, report_id: str) -> int:
        stmt = select(func.coalesce(func.max(ProjectReportVersion.version), 0)).where(
            ProjectReportVersion.report_id == report_id
        )
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def add(self, session: AsyncSession, row: ProjectReport | ProjectReportVersion):
        session.add(row)
        await session.flush()
        return row
