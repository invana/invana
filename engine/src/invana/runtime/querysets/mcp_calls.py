"""Queries behind Recent calls — the runs this Graph's MCP server opened."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.runtime.models import TaskRun, TriggeredBy


def _calls(graph_id: str):
    return (
        TaskRun.graph_id == graph_id,
        TaskRun.parent_run_id.is_(None),
        TaskRun.triggered_by == TriggeredBy.mcp.value,
    )


class McpCallQuerySet:
    async def recent(self, session: AsyncSession, *, graph_id: str, limit: int) -> list[TaskRun]:
        stmt = select(TaskRun).where(*_calls(graph_id)).order_by(TaskRun.queued_at.desc(), TaskRun.id).limit(limit)
        return list((await session.execute(stmt)).scalars().all())

    async def count(self, session: AsyncSession, *, graph_id: str, since: datetime | None = None) -> int:
        stmt = select(func.count()).select_from(TaskRun).where(*_calls(graph_id))
        if since is not None:
            stmt = stmt.where(TaskRun.queued_at >= since)
        return int((await session.execute(stmt)).scalar_one())
