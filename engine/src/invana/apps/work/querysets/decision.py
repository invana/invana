"""Queries against ``project_decisions`` and ``project_proposals``."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import Project, ProjectDecision, ProjectProposal


class ProjectDecisionQuerySet:
    async def list_for_branch(self, session: AsyncSession, *, branch_id: str) -> list[ProjectDecision]:
        stmt = select(ProjectDecision).where(ProjectDecision.branch_id == branch_id).order_by(ProjectDecision.number)
        return list((await session.execute(stmt)).scalars().all())

    async def list_for_graph(
        self, session: AsyncSession, *, graph_id: str, exclude_project_ids: set[str], project_id: str | None = None
    ) -> list[ProjectDecision]:
        """Every decision in a Graph, newest first, outside the projects named."""
        stmt = (
            select(ProjectDecision)
            .join(Project, Project.id == ProjectDecision.project_id)
            .where(Project.graph_id == graph_id)
            .order_by(ProjectDecision.created_at.desc())
        )
        if exclude_project_ids:
            stmt = stmt.where(Project.id.not_in(exclude_project_ids))
        if project_id is not None:
            stmt = stmt.where(Project.id == project_id)
        return list((await session.execute(stmt)).scalars().all())

    async def count_for_project(self, session: AsyncSession, *, project_id: str) -> int:
        stmt = select(func.count()).where(ProjectDecision.project_id == project_id)
        return int((await session.execute(stmt)).scalar_one())

    async def current_for(self, session: AsyncSession, *, branch_id: str) -> ProjectDecision | None:
        """The branch's decision nothing supersedes."""
        superseded = select(ProjectDecision.supersedes_id).where(ProjectDecision.supersedes_id.is_not(None))
        stmt = (
            select(ProjectDecision)
            .where(ProjectDecision.branch_id == branch_id, ProjectDecision.id.not_in(superseded))
            .order_by(ProjectDecision.number.desc())
        )
        return (await session.execute(stmt)).scalars().first()

    async def get_by_number(self, session: AsyncSession, *, project_id: str, number: int) -> ProjectDecision | None:
        stmt = select(ProjectDecision).where(ProjectDecision.project_id == project_id, ProjectDecision.number == number)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def numbers_by_ids(self, session: AsyncSession, ids: list[str]) -> dict[str, int]:
        ids = [i for i in ids if i]
        if not ids:
            return {}
        rows = await session.execute(
            select(ProjectDecision.id, ProjectDecision.number).where(ProjectDecision.id.in_(ids))
        )
        return dict(rows.all())

    async def superseded_by(self, session: AsyncSession, ids: list[str]) -> dict[str, int]:
        """For each decision id, the number of the decision that supersedes it."""
        if not ids:
            return {}
        stmt = select(ProjectDecision.supersedes_id, ProjectDecision.number).where(
            ProjectDecision.supersedes_id.in_(ids)
        )
        return dict((await session.execute(stmt)).all())

    async def next_number(self, session: AsyncSession, *, project_id: str) -> int:
        stmt = select(func.coalesce(func.max(ProjectDecision.number), 0)).where(
            ProjectDecision.project_id == project_id
        )
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def add(self, session: AsyncSession, decision: ProjectDecision) -> ProjectDecision:
        session.add(decision)
        await session.flush()
        return decision


class ProjectProposalQuerySet:
    async def list_for_project(
        self, session: AsyncSession, *, project_id: str, branch_id: str | None = None, status: str | None = None
    ) -> list[ProjectProposal]:
        stmt = select(ProjectProposal).where(ProjectProposal.project_id == project_id)
        if branch_id is not None:
            stmt = stmt.where(ProjectProposal.branch_id == branch_id)
        if status is not None:
            stmt = stmt.where(ProjectProposal.status == status)
        return list((await session.execute(stmt.order_by(ProjectProposal.number))).scalars().all())

    async def get_by_number(self, session: AsyncSession, *, project_id: str, number: int) -> ProjectProposal | None:
        stmt = select(ProjectProposal).where(ProjectProposal.project_id == project_id, ProjectProposal.number == number)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def next_number(self, session: AsyncSession, *, project_id: str) -> int:
        stmt = select(func.coalesce(func.max(ProjectProposal.number), 0)).where(
            ProjectProposal.project_id == project_id
        )
        return int((await session.execute(stmt)).scalar_one()) + 1

    async def add(self, session: AsyncSession, proposal: ProjectProposal) -> ProjectProposal:
        session.add(proposal)
        await session.flush()
        return proposal
