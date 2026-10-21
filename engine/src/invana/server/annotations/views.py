"""HTTP views for annotations (docs/for-developers/modules/explore/features/annotations.md).

Parse, call one manager, serialise (migration-plan §4.1).
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.annotations.managers import AnnotationManager
from invana.apps.annotations.schemas import (
    AnnotationCreate,
    AnnotationDetail,
    AnnotationListResponse,
    AnnotationScope,
    AnnotationUpdate,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

annotations = AnnotationManager()


async def list_annotations(
    record: list[str] | None = Query(default=None, max_length=2000),
    session_id: str | None = Query(default=None, alias="session"),
    scope: AnnotationScope = Query(default="graph"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AnnotationListResponse:
    items, total = await annotations.list(
        session,
        graph_id=graph.id,
        user_id=user.id,
        records=record,
        session_id=session_id,
        scope=scope,
        limit=limit,
        offset=offset,
    )
    return AnnotationListResponse(items=items, total=total)


async def create_annotation(
    payload: AnnotationCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AnnotationDetail:
    a = await annotations.create(session, graph_id=graph.id, user_id=user.id, payload=payload)
    return (await annotations.details(session, [a]))[0]


async def update_annotation(
    payload: AnnotationUpdate,
    annotation_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AnnotationDetail:
    a = await annotations.get(session, annotation_id=annotation_id, graph_id=graph.id, user_id=user.id)
    await annotations.update(session, annotation=a, user_id=user.id, payload=payload)
    return (await annotations.details(session, [a]))[0]


async def delete_annotation(
    annotation_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    a = await annotations.get(session, annotation_id=annotation_id, graph_id=graph.id, user_id=user.id)
    await annotations.delete(session, annotation=a, user_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
