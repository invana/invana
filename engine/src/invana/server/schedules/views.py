"""HTTP views for a Graph's schedules (docs/for-developers/modules/operate/features/schedules.md).

Parse, call one manager, serialise. Writing is the ``work`` area (contributor),
enforced by the guard; reading is open to every member. *Run now* queues a
firing and wakes the clock once the request has committed.
"""

from __future__ import annotations

from fastapi import BackgroundTasks, Depends, Path, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ScheduleManager
from invana.activity.schemas import (
    SCHEDULE_LIST,
    FiringListResponse,
    FiringRead,
    ScheduleCreate,
    SchedulePage,
    ScheduleRead,
    ScheduleUpdate,
)
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, applied_filters, list_params
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_schedules = ScheduleManager()


async def list_schedules(
    params: ListParams = Depends(list_params(SCHEDULE_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> SchedulePage:
    rows, info = await _schedules.page(session, graph=graph, params=params)
    return SchedulePage(
        items=[_schedules.read(r) for r in rows],
        total=info.total,
        unfiltered_total=info.unfiltered_total,
        next_cursor=info.next_cursor,
        applied=applied_filters(params, SCHEDULE_LIST),
        paused=await _schedules.paused_count(session, graph=graph),
    )


async def create_schedule(
    payload: ScheduleCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ScheduleRead:
    return _schedules.read(await _schedules.create(session, graph=graph, payload=payload, actor_id=user.id))


async def get_schedule(
    schedule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ScheduleRead:
    return _schedules.read(await _schedules.get(session, graph=graph, ref=schedule_id))


async def update_schedule(
    payload: ScheduleUpdate,
    schedule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ScheduleRead:
    row = await _schedules.update(session, graph=graph, ref=schedule_id, payload=payload, actor_id=user.id)
    return _schedules.read(row)


async def delete_schedule(
    schedule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _schedules.delete(session, graph=graph, ref=schedule_id, actor_id=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def pause_schedule(
    schedule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ScheduleRead:
    return _schedules.read(await _schedules.pause(session, graph=graph, ref=schedule_id, actor_id=user.id))


async def resume_schedule(
    schedule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ScheduleRead:
    return _schedules.read(await _schedules.resume(session, graph=graph, ref=schedule_id, actor_id=user.id))


async def run_schedule(
    request: Request,
    background: BackgroundTasks,
    schedule_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FiringRead:
    """Queue a firing now; the clock opens its run as soon as this commits."""
    firing = await _schedules.run_now(session, graph=graph, ref=schedule_id, actor_id=user.id)
    clock = getattr(request.app.state, "clock", None)
    if clock is not None:
        background.add_task(clock.wake)
    return FiringRead.model_validate(firing)


async def list_firings(
    schedule_id: str = Path(...),
    limit: int = Query(50, ge=1, le=200),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> FiringListResponse:
    rows = await _schedules.firings(session, graph=graph, ref=schedule_id, limit=limit)
    return FiringListResponse(items=[FiringRead.model_validate(r) for r in rows], total=len(rows))
