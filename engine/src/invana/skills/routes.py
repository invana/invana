"""HTTP routes for graph-scoped Skills (MVP § 2.4).

Endpoints (all under ``/api/v1/u/{username}/{graphSlug}/skills``)
----------------------------------------------------------------
GET    /         list
POST   /         create
GET    /{id}     detail
PATCH  /{id}     update
DELETE /{id}     hard delete
"""

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
from invana.skills import services
from invana.skills.schemas import (
    SkillCreate,
    SkillListResponse,
    SkillRead,
    SkillUpdate,
)

skills_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/skills",
    tags=["skills"],
)


@skills_router.get("", response_model=SkillListResponse)
async def list_skills(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillListResponse:
    items = await services.list_skills(session, graph_id=graph.id)
    reads = [SkillRead.model_validate(s) for s in items]
    return SkillListResponse(items=reads, total=len(reads))


@skills_router.post("", response_model=SkillRead, status_code=status.HTTP_201_CREATED)
async def create_skill(
    payload: SkillCreate,
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await services.create_skill(session, graph_id=graph.id, payload=payload, actor_id=user.id)
    await session.commit()
    await session.refresh(skill)
    return SkillRead.model_validate(skill)


@skills_router.get("/{skill_id}", response_model=SkillRead)
async def get_skill(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await services.get_or_404(session, skill_id=skill_id, graph_id=graph.id)
    return SkillRead.model_validate(skill)


@skills_router.patch("/{skill_id}", response_model=SkillRead)
async def update_skill(
    payload: SkillUpdate,
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SkillRead:
    skill = await services.get_or_404(session, skill_id=skill_id, graph_id=graph.id)
    updated = await services.update_skill(session, skill=skill, payload=payload, actor_id=user.id)
    await session.commit()
    await session.refresh(updated)
    return SkillRead.model_validate(updated)


@skills_router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: str = Path(...),
    _: GraphMember = Depends(require_graph_admin),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    skill = await services.get_or_404(session, skill_id=skill_id, graph_id=graph.id)
    await services.delete_skill(session, skill=skill, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
