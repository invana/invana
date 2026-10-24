"""HTTP views for approvals (docs/for-developers/modules/operate/features/approvals.md).

Parse, call one manager, serialise. Deciding is the ``ask`` area for the guard;
the approver list, not a Graph role, is the bound, and the manager enforces it.
A decision wakes the clock once the request has committed, so what waited on
it — a publish review's migration run — moves without waiting for a tick.

**A run's ``send`` step waits here too**
(docs/for-developers/modules/platform/features/tool-plugins.md). The gate is
:class:`~invana.activity.managers.ApprovalSendGate`, installed when the app
builds its runtime. A decision on an approval whose subject is a step resumes
its run once the request has committed, through the runtime the app holds —
approved sends, declined fails the step as *not sent*.
"""

from __future__ import annotations

from fastapi import BackgroundTasks, Depends, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ApprovalManager
from invana.activity.models import Approval
from invana.activity.schemas import APPROVAL_LIST, ApprovalDecide, ApprovalRead
from invana.apps.graphs.models import Graph, GraphMember
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.lists import ListParams, Page, applied_filters, list_params
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

_approvals = ApprovalManager()


def _wake_clock(request: Request, background: BackgroundTasks) -> None:
    clock = getattr(request.app.state, "clock", None)
    if clock is not None:
        background.add_task(clock.wake)


def _resume_run(request: Request, background: BackgroundTasks, row: Approval) -> None:
    """A step's approval is decided: resume its run once the decision has committed."""
    runtime = getattr(request.app.state, "task_runtime", None)
    if row.subject_kind == "step" and row.run_id and runtime is not None:
        background.add_task(runtime.resume_after_decision, row.run_id)


async def list_approvals(
    params: ListParams = Depends(list_params(APPROVAL_LIST)),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Page[ApprovalRead]:
    mine = user if params.one("mine") else None
    rows, info = await _approvals.page(session, graph=graph, params=params, mine=mine)
    return Page[ApprovalRead].of(
        [ApprovalRead.model_validate(r) for r in rows], info, applied_filters(params, APPROVAL_LIST)
    )


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
    _resume_run(request, background, row)
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
    _resume_run(request, background, row)
    return ApprovalRead.model_validate(row)
