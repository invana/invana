"""HTTP routes for graph-scoped Explorer Canvases (RFC-043).

Canvases are **shared across every graph member** (contrast sessions, which are
private): the routes gate on ``require_graph_member`` only and never filter by
creator. Each canvas is backed 1:1 by a session the creator owns.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.canvases import services
from invana.canvases.schemas import (
    CanvasCreate,
    CanvasDetail,
    CanvasListResponse,
    CanvasSummary,
    CanvasUpdate,
)
from invana.db import get_session
from invana.graphs.deps import require_graph_member, resolve_graph_by_username_slug
from invana.graphs.models import Graph, GraphMember

canvases_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/canvases",
    tags=["canvases"],
)


@canvases_router.get("", response_model=CanvasListResponse)
async def list_canvases(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: Literal["updated", "created"] = Query(default="updated"),
    include_archived: bool = Query(default=False),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> CanvasListResponse:
    items, total = await services.list_canvases(
        session,
        graph_id=graph.id,
        limit=limit,
        offset=offset,
        sort=sort,
        include_archived=include_archived,
    )
    return CanvasListResponse(items=[CanvasSummary.model_validate(c) for c in items], total=total)


@canvases_router.post("", response_model=CanvasDetail, status_code=status.HTTP_201_CREATED)
async def create_canvas(
    payload: CanvasCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CanvasDetail:
    canvas = await services.create_canvas(session, graph_id=graph.id, user_id=user.id, payload=payload)
    await session.commit()
    await session.refresh(canvas)
    return CanvasDetail.model_validate(canvas)


@canvases_router.get("/{canvas_id}", response_model=CanvasDetail)
async def get_canvas(
    canvas_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> CanvasDetail:
    canvas = await services.get_or_404(session, canvas_id=canvas_id, graph_id=graph.id)
    return CanvasDetail.model_validate(canvas)


@canvases_router.patch("/{canvas_id}", response_model=CanvasDetail)
async def update_canvas(
    payload: CanvasUpdate,
    canvas_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CanvasDetail:
    canvas = await services.get_or_404(session, canvas_id=canvas_id, graph_id=graph.id)
    await services.update_canvas(session, canvas=canvas, payload=payload, actor_id=user.id)
    await session.commit()
    await session.refresh(canvas)
    return CanvasDetail.model_validate(canvas)


@canvases_router.delete("/{canvas_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_canvas(
    canvas_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    canvas = await services.get_or_404(session, canvas_id=canvas_id, graph_id=graph.id)
    await services.delete_canvas(session, canvas=canvas, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
