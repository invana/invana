"""Queries against ``graph_query_log`` — every logged graph query (MP12 · MP15)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import delete, select

from invana.apps.modeller.models import GraphQueryLog

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class GraphQueryLogQuerySet:
    async def add_many(self, session: AsyncSession, rows: list[GraphQueryLog]) -> None:
        session.add_all(rows)
        await session.flush()

    async def since(self, session: AsyncSession, graph_id: str, start: datetime) -> list[GraphQueryLog]:
        """Every logged query on the Graph after ``start``, oldest first."""
        stmt = (
            select(GraphQueryLog)
            .where(GraphQueryLog.graph_id == graph_id, GraphQueryLog.at > start)
            .order_by(GraphQueryLog.at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def of_shape(
        self, session: AsyncSession, graph_id: str, shape_hash: str, start: datetime
    ) -> list[GraphQueryLog]:
        stmt = (
            select(GraphQueryLog)
            .where(
                GraphQueryLog.graph_id == graph_id,
                GraphQueryLog.shape_hash == shape_hash,
                GraphQueryLog.at > start,
            )
            .order_by(GraphQueryLog.at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def explained(self, session: AsyncSession, graph_id: str, shape_hash: str) -> GraphQueryLog | None:
        """The latest row of this shape that carries its plan (MP38)."""
        stmt = (
            select(GraphQueryLog)
            .where(
                GraphQueryLog.graph_id == graph_id,
                GraphQueryLog.shape_hash == shape_hash,
                GraphQueryLog.touched_from == "plan",
            )
            .order_by(GraphQueryLog.at.desc())
            .limit(50)
        )
        for row in (await session.execute(stmt)).scalars():
            if (row.properties_touched or {}).get("plan"):
                return row
        return None

    async def prune(self, session: AsyncSession, before: datetime) -> int:
        result = await session.execute(delete(GraphQueryLog).where(GraphQueryLog.at < before))
        return result.rowcount or 0
