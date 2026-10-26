"""Queries against ``mcp_served``."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.mcp_server.models import McpServed


class ServedQuerySet:
    async def for_graph(self, session: AsyncSession, *, graph_id: str) -> list[McpServed]:
        stmt = select(McpServed).where(McpServed.graph_id == graph_id)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, *, graph_id: str, kind: str, ref: str) -> McpServed | None:
        return await session.get(McpServed, (graph_id, kind, ref))

    async def add(self, session: AsyncSession, row: McpServed) -> None:
        session.add(row)
        await session.flush()
