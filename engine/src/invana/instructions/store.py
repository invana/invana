"""DB access layer for ``instructions`` rows."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.instructions.models import Instruction


class InstructionStore:
    async def list_for_graph(self, session: AsyncSession, graph_id: str) -> list[Instruction]:
        stmt = (
            select(Instruction)
            .where(Instruction.graph_id == graph_id)
            # Higher priority first; tie-break alphabetically for stable order.
            .order_by(Instruction.priority.desc(), Instruction.name)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, instruction_id: str) -> Instruction | None:
        stmt = select(Instruction).where(Instruction.id == instruction_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, instruction: Instruction) -> Instruction:
        session.add(instruction)
        await session.flush()
        return instruction

    async def delete(self, session: AsyncSession, instruction: Instruction) -> None:
        await session.delete(instruction)
