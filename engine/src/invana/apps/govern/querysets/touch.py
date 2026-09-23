"""Queries against ``run_touches`` — the run dashboard's reads, and `Compare`'s.

Every one of these is a question the ledger can answer and an index cannot: for
one run, in ``seq`` order; for two runs, what differed; for a Graph, who ever
touched an address. That last one is why the table exists at all
([GV20](docs/for-developers/modules/govern/spec.md)).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.models import RunTouch, TouchDirection


class TouchQuerySet:
    async def list_for_run(self, session: AsyncSession, run_id: str) -> list[RunTouch]:
        """Everything the run engaged, **in ``seq`` order, refusals included**.

        Never filtered: a refusal is struck in place rather than hidden, because
        what a run was turned away from is part of what it did.
        """
        stmt = select(RunTouch).where(RunTouch.run_id == run_id).order_by(RunTouch.seq)
        return list((await session.execute(stmt)).scalars().all())

    async def get_at(self, session: AsyncSession, run_id: str, seq: int) -> RunTouch | None:
        stmt = select(RunTouch).where(RunTouch.run_id == run_id, RunTouch.seq == seq)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def addresses_for_runs(self, session: AsyncSession, run_ids: list[str]) -> dict[str, set[str]]:
        """``{run_id: {address, …}}`` for several runs in one read.

        `Compare` is a join, not two scans — which is the whole argument for
        this table over walking ``task_stream`` twice.
        """
        stmt = (
            select(RunTouch.run_id, RunTouch.address)
            .where(RunTouch.run_id.in_(run_ids))
            .group_by(RunTouch.run_id, RunTouch.address)
        )
        out: dict[str, set[str]] = {run_id: set() for run_id in run_ids}
        for run_id, address in (await session.execute(stmt)).all():
            out.setdefault(run_id, set()).add(address)
        return out

    async def applied_for_runs(self, session: AsyncSession, run_ids: list[str]) -> dict[str, dict[str, dict]]:
        """``{run_id: {address: applied}}`` — what the lens did, per participant.

        **The first touch on an address is the run's answer for it.** A run
        dispatches under one frozen lens ([GV8]), so reading the same
        participant twice applies the same narrowing twice; keeping one is not
        a choice about which is truer, it is the observation that there is only
        one. Read in ``seq`` order so *first* means what it says.
        """
        stmt = (
            select(RunTouch.run_id, RunTouch.address, RunTouch.applied)
            .where(RunTouch.run_id.in_(run_ids))
            .order_by(RunTouch.seq)
        )
        out: dict[str, dict[str, dict]] = {run_id: {} for run_id in run_ids}
        for run_id, address, applied in (await session.execute(stmt)).all():
            out.setdefault(run_id, {}).setdefault(address, applied or {})
        return out

    async def counts_for_run(self, session: AsyncSession, run_id: str) -> dict[str, int]:
        """``{direction: n}`` — the dashboard's *recorded 23 · refused 2 · sent out 0*."""
        stmt = (
            select(RunTouch.direction, func.count(RunTouch.id))
            .where(RunTouch.run_id == run_id)
            .group_by(RunTouch.direction)
        )
        return dict((await session.execute(stmt)).all())  # type: ignore[arg-type]

    async def distinct_addresses(self, session: AsyncSession, run_id: str) -> list[str]:
        """What the run actually touched — *touched 7 of the 11 allowed*."""
        stmt = (
            select(RunTouch.address)
            .where(RunTouch.run_id == run_id, RunTouch.direction != TouchDirection.refused.value)
            .group_by(RunTouch.address)
            .order_by(RunTouch.address)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def runs_touching(self, session: AsyncSession, graph_id: str, address: str, limit: int = 50) -> list[str]:
        """Which runs in this Graph ever engaged one participant.

        *Tighten egress; the runs that did it are listed* — the tuning loop
        needs the list, not a count.
        """
        stmt = (
            select(RunTouch.run_id)
            .where(RunTouch.graph_id == graph_id, RunTouch.address == address)
            .group_by(RunTouch.run_id)
            .order_by(func.max(RunTouch.at).desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, touch: RunTouch) -> RunTouch:
        session.add(touch)
        await session.flush()
        return touch
