"""Queries against ``project_branches`` and ``branch_findings``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import BranchFinding, ProjectBranch, ProjectFinding


class ProjectBranchQuerySet:
    async def list_for_project(self, session: AsyncSession, *, project_id: str) -> list[ProjectBranch]:
        stmt = select(ProjectBranch).where(ProjectBranch.project_id == project_id).order_by(ProjectBranch.number)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, branch_id: str) -> ProjectBranch | None:
        return await session.get(ProjectBranch, branch_id)

    async def get_by_number(self, session: AsyncSession, *, project_id: str, number: int) -> ProjectBranch | None:
        stmt = select(ProjectBranch).where(ProjectBranch.project_id == project_id, ProjectBranch.number == number)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def numbers_by_ids(self, session: AsyncSession, ids: list[str]) -> dict[str, int]:
        ids = [i for i in ids if i]
        if not ids:
            return {}
        rows = await session.execute(select(ProjectBranch.id, ProjectBranch.number).where(ProjectBranch.id.in_(ids)))
        return dict(rows.all())

    async def next_number(self, session: AsyncSession, *, project_id: str) -> int:
        stmt = select(func.coalesce(func.max(ProjectBranch.number), 0)).where(ProjectBranch.project_id == project_id)
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def add(self, session: AsyncSession, branch: ProjectBranch) -> ProjectBranch:
        session.add(branch)
        await session.flush()
        return branch


class BranchFindingQuerySet:
    async def findings_of(self, session: AsyncSession, *, branch_id: str) -> list[tuple[ProjectFinding, str]]:
        """Every finding counted on a branch, with how it got there, oldest first."""
        stmt = (
            select(ProjectFinding, BranchFinding.via)
            .join(BranchFinding, BranchFinding.finding_id == ProjectFinding.id)
            .where(BranchFinding.branch_id == branch_id)
            .order_by(ProjectFinding.number)
        )
        return [(f, via) for f, via in (await session.execute(stmt)).all()]

    async def stance_counts(self, session: AsyncSession, *, branch_ids: list[str]) -> dict[str, dict[str, int]]:
        if not branch_ids:
            return {}
        stmt = (
            select(BranchFinding.branch_id, ProjectFinding.stance, func.count())
            .join(ProjectFinding, BranchFinding.finding_id == ProjectFinding.id)
            .where(BranchFinding.branch_id.in_(branch_ids))
            .group_by(BranchFinding.branch_id, ProjectFinding.stance)
        )
        out: dict[str, dict[str, int]] = {}
        for branch_id, stance, count in (await session.execute(stmt)).all():
            out.setdefault(branch_id, {})[stance] = int(count)
        return out

    async def linked_ids(self, session: AsyncSession, *, branch_id: str) -> set[str]:
        stmt = select(BranchFinding.finding_id).where(BranchFinding.branch_id == branch_id)
        return set((await session.execute(stmt)).scalars().all())

    async def link(self, session: AsyncSession, *, branch_id: str, finding_ids: list[str], via: str) -> None:
        present = await self.linked_ids(session, branch_id=branch_id)
        for finding_id in finding_ids:
            if finding_id not in present:
                session.add(BranchFinding(branch_id=branch_id, finding_id=finding_id, via=via))
        await session.flush()
