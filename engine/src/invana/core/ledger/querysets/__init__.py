"""Every query the ledger's writer and verifier run."""

from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.ledger.models import LedgerCheck, LedgerRow


class LedgerQuerySet:
    async def lock_graph(self, db: AsyncSession, graph_id: str) -> None:
        """Serialise writers on one Graph's chain for the rest of the transaction.

        Postgres only; SQLite holds one writer at a time already.
        """
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"ledger:{graph_id}"})

    async def head(self, db: AsyncSession, graph_id: str) -> LedgerRow | None:
        stmt = select(LedgerRow).where(LedgerRow.graph_id == graph_id).order_by(LedgerRow.seq.desc()).limit(1)
        return (await db.execute(stmt)).scalars().first()

    async def after(self, db: AsyncSession, graph_id: str, seq: int, *, limit: int = 5000) -> list[LedgerRow]:
        stmt = (
            select(LedgerRow)
            .where(LedgerRow.graph_id == graph_id, LedgerRow.seq > seq)
            .order_by(LedgerRow.seq)
            .limit(limit)
        )
        return list((await db.execute(stmt)).scalars().all())

    async def at_seq(self, db: AsyncSession, graph_id: str, seq: int) -> LedgerRow | None:
        stmt = select(LedgerRow).where(LedgerRow.graph_id == graph_id, LedgerRow.seq == seq)
        return (await db.execute(stmt)).scalars().first()

    async def check(self, db: AsyncSession, graph_id: str) -> LedgerCheck | None:
        return await db.get(LedgerCheck, graph_id)

    async def graph_ids(self, db: AsyncSession) -> list[str]:
        stmt = select(LedgerRow.graph_id).distinct()
        return list((await db.execute(stmt)).scalars().all())
