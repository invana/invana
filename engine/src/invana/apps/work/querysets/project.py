"""Queries against ``projects``."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.work.models import Project


class ProjectQuerySet:
    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[Project]:
        stmt = select(Project).where(Project.graph_id == graph_id).order_by(Project.status, Project.name)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, project_id: str) -> Project | None:
        return await session.get(Project, project_id)

    async def get_by_key(self, session: AsyncSession, *, key: str, graph_id: str) -> Project | None:
        stmt = select(Project).where(Project.graph_id == graph_id, Project.key == key)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def keys_by_ids(self, session: AsyncSession, ids: list[str]) -> dict[str, str]:
        if not ids:
            return {}
        rows = (await session.execute(select(Project.id, Project.key).where(Project.id.in_(ids)))).all()
        return dict(rows)

    async def add(self, session: AsyncSession, project: Project) -> Project:
        session.add(project)
        await session.flush()
        return project

    async def delete(self, session: AsyncSession, project: Project) -> None:
        await session.delete(project)
