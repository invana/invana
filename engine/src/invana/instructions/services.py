"""Service layer for Instruction CRUD."""

from __future__ import annotations

from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.events import actions
from invana.events.services import current_trace_id, diff_changed_fields, emit_event
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
    actor_id: str,
) -> Instruction:
    instruction = Instruction(
        graph_id=graph_id,
        name=payload.name,
        content=payload.content,
        priority=payload.priority,
    )
    try:
        await InstructionStore().add(session, instruction)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail=f"An instruction named '{payload.name}' already exists in this Graph.",
        ) from exc
    await emit_event(
        session,
        action=actions.INSTRUCTION_CREATE,
        target_kind=actions.TARGET_INSTRUCTION,
        target_id=instruction.id,
        graph_id=graph_id,
        actor_id=actor_id,
        details={"name": instruction.name, "priority": instruction.priority},
        trace_id=current_trace_id(),
    )
    return instruction


async def update_instruction(
    session: AsyncSession,
    *,
    instruction: Instruction,
    payload: InstructionUpdate,
    actor_id: str,
) -> Instruction:
    before = {
        "name": instruction.name,
        "content": instruction.content,
        "priority": instruction.priority,
    }
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
    after = {
        "name": instruction.name,
        "content": instruction.content,
        "priority": instruction.priority,
    }
    changed = diff_changed_fields(before, after, fields=["name", "content", "priority"])
    if changed:
        await emit_event(
            session,
            action=actions.INSTRUCTION_UPDATE,
            target_kind=actions.TARGET_INSTRUCTION,
            target_id=instruction.id,
            graph_id=instruction.graph_id,
            actor_id=actor_id,
            details={"changed": changed, "name": instruction.name},
            trace_id=current_trace_id(),
        )
    return instruction


async def delete_instruction(
    session: AsyncSession,
    *,
    instruction: Instruction,
    actor_id: str,
) -> None:
    name = instruction.name
    graph_id = instruction.graph_id
    instruction_id = instruction.id
    await InstructionStore().delete(session, instruction)
    await emit_event(
        session,
        action=actions.INSTRUCTION_DELETE,
        target_kind=actions.TARGET_INSTRUCTION,
        target_id=instruction_id,
        graph_id=graph_id,
        actor_id=actor_id,
        details={"name": name},
        trace_id=current_trace_id(),
    )
