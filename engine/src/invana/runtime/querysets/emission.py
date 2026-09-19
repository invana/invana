"""Queries against ``emissions`` — what a run produced."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.runtime.models import Emission


class EmissionQuerySet:
    async def get(self, session: AsyncSession, emission_id: str) -> Emission | None:
        return await session.get(Emission, emission_id)

    async def for_run(self, session: AsyncSession, *, run_id: str) -> list[Emission]:
        stmt = select(Emission).where(Emission.run_id == run_id).order_by(Emission.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, emission: Emission) -> Emission:
        session.add(emission)
        await session.flush()
        return emission
