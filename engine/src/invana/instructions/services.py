"""Service layer for Instruction CRUD."""

from __future__ import annotations

from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.instructions.models import Instruction
from invana.instructions.schemas import InstructionCreate, InstructionUpdate
from invana.instructions.store import InstructionStore


async def list_instructions(session: AsyncSession, *, graph_id: str) -> list[Instruction]:
    return await InstructionStore().list_for_graph(session, graph_id)


async def get_or_404(session: AsyncSession, *, instruction_id: str, graph_id: str) -> Instruction:
    instruction = await InstructionStore().get(session, instruction_id)
    if instruction is None or instruction.graph_id != graph_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Instruction not found.")
    return instruction


async def create_instruction(
    session: AsyncSession,
    *,
    graph_id: str,
    payload: InstructionCreate,
) -> Instruction:
    instruction = Instruction(
        graph_id=graph_id,
        name=payload.name,
        content=payload.content,
        priority=payload.priority,
    )
    try:
        return await InstructionStore().add(session, instruction)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail=f"An instruction named '{payload.name}' already exists in this Graph.",
        ) from exc


async def update_instruction(
    session: AsyncSession,
    *,
    instruction: Instruction,
    payload: InstructionUpdate,
) -> Instruction:
    if payload.name is not None:
        instruction.name = payload.name
    if payload.content is not None:
        instruction.content = payload.content
    if payload.priority is not None:
        instruction.priority = payload.priority
    try:
        await session.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail=f"An instruction named '{instruction.name}' already exists in this Graph.",
        ) from exc
    return instruction


async def delete_instruction(session: AsyncSession, *, instruction: Instruction) -> None:
    await InstructionStore().delete(session, instruction)
