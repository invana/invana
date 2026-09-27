"""Queries against ``type_count_snapshots`` — a type's count, per act that wrote (MP14)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from invana.apps.modeller.models import TypeCountSnapshot

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class TypeCountSnapshotQuerySet:
    async def add_many(self, session: AsyncSession, rows: list[TypeCountSnapshot]) -> None:
        session.add_all(rows)
        await session.flush()

    async def since(self, session: AsyncSession, graph_id: str, start: datetime) -> list[TypeCountSnapshot]:
        """Every snapshot after ``start``, oldest first."""
        stmt = (
            select(TypeCountSnapshot)
            .where(TypeCountSnapshot.graph_id == graph_id, TypeCountSnapshot.at > start)
            .order_by(TypeCountSnapshot.at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def openers(self, session: AsyncSession, graph_id: str, start: datetime) -> list[TypeCountSnapshot]:
        """Each type's last snapshot at or before ``start`` — the window's opening value (MP14)."""
        ranked = (
            select(
                TypeCountSnapshot.id,
                func.row_number()
                .over(
                    partition_by=(TypeCountSnapshot.kind, TypeCountSnapshot.type_name),
                    order_by=TypeCountSnapshot.at.desc(),
                )
                .label("rank"),
            )
            .where(TypeCountSnapshot.graph_id == graph_id, TypeCountSnapshot.at <= start)
            .subquery()
        )
        stmt = select(TypeCountSnapshot).join(ranked, ranked.c.id == TypeCountSnapshot.id).where(ranked.c.rank == 1)
        return list((await session.execute(stmt)).scalars().all())

    async def last_at(self, session: AsyncSession, graph_id: str, *, source: str) -> datetime | None:
        """When ``source`` last counted anything on this Graph."""
        stmt = select(func.max(TypeCountSnapshot.at)).where(
            TypeCountSnapshot.graph_id == graph_id, TypeCountSnapshot.source == source
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def latest_degrees(self, session: AsyncSession, graph_id: str) -> dict[str, tuple[int, int]]:
        """Each node label's latest ``(max, median)`` degree, where one was ever taken (MP40)."""
        stmt = (
            select(TypeCountSnapshot)
            .where(
                TypeCountSnapshot.graph_id == graph_id,
                TypeCountSnapshot.kind == "node",
                TypeCountSnapshot.max_degree.is_not(None),
            )
            .order_by(TypeCountSnapshot.at)
        )
        out: dict[str, tuple[int, int]] = {}
        for snap in (await session.execute(stmt)).scalars():
            out[snap.type_name] = (snap.max_degree or 0, snap.median_degree or 0)
        return out
