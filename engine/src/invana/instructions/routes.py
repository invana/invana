"""HTTP routes for graph-scoped Instructions (MVP § 2.5)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.graphs.deps import (
    require_graph_admin,
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.graphs.models import Graph, GraphMember
from invana.instructions import services
from invana.instructions.schemas import (
    InstructionCreate,
    InstructionListResponse,
    InstructionRead,
    InstructionUpdate,
)

instructions_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/instructions",
    tags=["instructions"],
)


@instructions_router.get("", response_model=InstructionListResponse)
async def list_instructions(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> InstructionListResponse:
    items = await services.list_instructions(session, graph_id=graph.id)
    reads = [InstructionRead.model_validate(i) for i in items]
    return InstructionListResponse(items=reads, total=len(reads))


@instructions_router.post(
    "",
    response_model=InstructionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_instruction(
    payload: InstructionCreate,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InstructionRead:
    instruction = await services.create_instruction(
        session,
        graph_id=graph.id,
        payload=payload,
        actor_id=user.id,
    )
    await session.commit()
    await session.refresh(instruction)
    return InstructionRead.model_validate(instruction)


@instructions_router.get("/{instruction_id}", response_model=InstructionRead)
async def get_instruction(
    instruction_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> InstructionRead:
    instruction = await services.get_or_404(
        session,
        instruction_id=instruction_id,
        graph_id=graph.id,
    )
    return InstructionRead.model_validate(instruction)


@instructions_router.patch("/{instruction_id}", response_model=InstructionRead)
async def update_instruction(
    payload: InstructionUpdate,
    instruction_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InstructionRead:
    instruction = await services.get_or_404(
        session,
        instruction_id=instruction_id,
        graph_id=graph.id,
    )
    updated = await services.update_instruction(
        session,
        instruction=instruction,
        payload=payload,
        actor_id=user.id,
    )
    await session.commit()
    await session.refresh(updated)
    return InstructionRead.model_validate(updated)


@instructions_router.delete("/{instruction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instruction(
    instruction_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    instruction = await services.get_or_404(
        session,
        instruction_id=instruction_id,
        graph_id=graph.id,
    )
    await services.delete_instruction(session, instruction=instruction, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
