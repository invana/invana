"""HTTP views for the workflow library.

Parse, call one manager, serialise (migration-plan §4.1). The read-models come
from ``runtime.managers.TaskPlanRunsManager`` because they carry run statistics,
which live in ``runs`` — a band an app may not reach.
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.task_plans.schemas import (
    PlanPerformance,
    PlanRunsPage,
    PlanVersionDiff,
    PromoteRequest,
    TaskPlanDetail,
    TaskPlanListResponse,
    TaskPlanRead,
    TasksResponse,
)
from invana.apps.task_plans.yaml_export import to_yaml
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.errors import ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.runtime.managers import PlanPerformanceManager, TaskPlanRunsManager
from invana.runtime.managers.plan_performance import WINDOWS
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

library = TaskPlanRunsManager()
behaviour = PlanPerformanceManager()


async def list_workflows(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskPlanListResponse:
    items = await library.list_reads(session, graph_id=graph.id)
    return TaskPlanListResponse(items=items, total=len(items))


async def get_workflow(
    key: str = Path(...),
    version: int | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskPlanDetail:
    workflow = await library.get(session, graph_id=graph.id, key=key, version=version)
    return await library.detail(session, workflow=workflow)


async def plan_diff(
    key: str = Path(...),
    version: int | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> PlanVersionDiff:
    """What changed against the version before it (LB37)."""
    workflow = await library.get(session, graph_id=graph.id, key=key, version=version)
    return await library.diff(session, workflow=workflow)


async def get_plan_tasks(
    key: str = Path(...),
    version: int | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TasksResponse:
    """The plan's nodes and the order between them — nothing else about it."""
    workflow = await library.get(session, graph_id=graph.id, key=key, version=version)
    detail = await library.detail(session, workflow=workflow)
    return TasksResponse(nodes=detail.nodes, edges=detail.edges)


def _window(window: str) -> int:
    """``7d`` · ``30d`` · ``90d`` — the plan page's three windows, and no others."""
    days = int(window[:-1]) if window.endswith("d") and window[:-1].isdigit() else 0
    if days not in WINDOWS:
        raise ValidationError(f"window must be one of {', '.join(f'{d}d' for d in WINDOWS)}.")
    return days


async def plan_performance(
    key: str = Path(...),
    version: int | None = Query(default=None),
    window: str = Query(default="30d"),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> PlanPerformance:
    """How the plan has behaved — the Overview, Layers and Flow tabs (LB33 · LB36)."""
    workflow = await library.get(session, graph_id=graph.id, key=key, version=version)
    return await behaviour.performance(session, plan=workflow, window=_window(window))


async def plan_runs(
    key: str = Path(...),
    version: int | None = Query(default=None),
    window: str = Query(default="30d"),
    status: str | None = Query(default=None),
    called_by: str | None = Query(default=None),
    agent_id: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> PlanRunsPage:
    """Every run of the plan, newest first — the Activity tab (LB34)."""
    workflow = await library.get(session, graph_id=graph.id, key=key, version=version)
    return await behaviour.runs(
        session,
        plan=workflow,
        window=_window(window),
        status=status,
        called_by=called_by,
        agent_id=agent_id,
        cursor=cursor,
        limit=limit,
    )


async def export_workflow(
    key: str = Path(...),
    version: int | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """The surface form (docs/for-developers/modules/agents/spec.md, *one schema, two encodings*)."""
    workflow = await library.get(session, graph_id=graph.id, key=key, version=version)
    return Response(
        content=to_yaml(workflow, await library.workflows_qs.tasks_for(session, plan_id=workflow.id)),
        media_type="application/yaml",
        headers={"Content-Disposition": f'attachment; filename="{workflow.key}@{workflow.version}.yaml"'},
    )


async def promote(
    payload: PromoteRequest,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskPlanRead:
    """Turn a plan that served into a library entry — the one write in MVP.

    This is the *review* stage of docs/for-developers/modules/workflows/features/promote-a-plan.md, applied to plans: a
    human decides that a
    generated shape is worth keeping, and it gets a key and a version so the
    next promotion is diffable against it.
    """
    workflow = await library.promote_plan(
        session,
        graph=graph,
        run_id=payload.run_id,
        key=payload.key,
        description=payload.description,
        intents=payload.intents,
        actor=user,
    )
    await emit_event(
        session,
        action=actions.WORKFLOW_PROMOTE,
        target_kind=actions.TARGET_WORKFLOW,
        target_id=workflow.id,
        graph_id=graph.id,
        run_id=payload.run_id,
        actor_id=user.id,
        details={"key": workflow.key, "version": workflow.version},
    )
    read = TaskPlanRead.model_validate(workflow)
    read.step_count = len(await library.workflows_qs.tasks_for(session, plan_id=workflow.id))
    return read
