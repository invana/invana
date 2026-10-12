"""HTTP views for approvals (docs/for-developers/modules/operate/features/approvals.md).

Parse, call one manager, serialise. Deciding is the ``ask`` area for the guard;
the approver list, not a Graph role, is the bound, and the manager enforces it.
A decision wakes the clock once the request has committed, so what waited on
it — a publish review's migration run — moves without waiting for a tick.
"""

from __future__ import annotations

from fastapi import BackgroundTasks, Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ApprovalManager
from invana.activity.schemas import ApprovalDecide, ApprovalListResponse, ApprovalRead
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_approvals = ApprovalManager()


def _wake_clock(request: Request, background: BackgroundTasks) -> None:
    clock = getattr(request.app.state, "clock", None)
    if clock is not None:
        background.add_task(clock.wake)


async def list_approvals(
    status: str | None = Query(None, description="pending · approved · declined · expired"),
    mine: bool = Query(False, description="Only what waits on me."),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApprovalListResponse:
    rows = await _approvals.list(session, graph=graph, status=status, mine=user if mine else None)
    return ApprovalListResponse(items=[ApprovalRead.model_validate(r) for r in rows], total=len(rows))


async def get_approval(
    approval_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ApprovalRead:
    return ApprovalRead.model_validate(await _approvals.get(session, graph=graph, approval_id=approval_id))


async def approve(
    payload: ApprovalDecide,
    request: Request,
    background: BackgroundTasks,
    approval_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApprovalRead:
    row = await _approvals.decide(
        session, graph=graph, approval_id=approval_id, user=user, approve=True, note=payload.note
    )
    _wake_clock(request, background)
    return ApprovalRead.model_validate(row)


async def decline(
    payload: ApprovalDecide,
    request: Request,
    background: BackgroundTasks,
    approval_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApprovalRead:
    row = await _approvals.decide(
        session, graph=graph, approval_id=approval_id, user=user, approve=False, note=payload.note
    )
    _wake_clock(request, background)
    return ApprovalRead.model_validate(row)
