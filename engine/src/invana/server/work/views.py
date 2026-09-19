"""HTTP views for Work — tasks, their dependencies, projects and staffing.

**`accept` takes a ``user`` dependency and nothing else calls it.** That is how
"an agent cannot accept its own task" is enforced — by there being no path, not
by a check an agent-side caller could route around.

Parse, call one manager, serialise (migration-plan §4.1).
"""

from __future__ import annotations

from fastapi import Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import TaskReadManager, TreeManager
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.work.managers import (
    DependencyManager,
    PlanManager,
    ProjectManager,
    StaffingManager,
    TaskManager,
)
from invana.apps.work.models import TaskStatus
from invana.apps.work.schemas import (
    AssignmentCreate,
    AssignmentListResponse,
    AssignmentRead,
    DependencyCreate,
    ProjectCreate,
    ProjectListResponse,
    ProjectPlanResponse,
    ProjectRead,
    ProjectUpdate,
    TaskActivityResponse,
    TaskCreate,
    TaskListResponse,
    TaskRead,
    TaskRejectRequest,
    TaskResultRequest,
    TaskUpdate,
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.events.models import ActorKind
from invana.server.graphs.deps import require_graph_member, resolve_graph_by_username_slug

tasks = TaskManager()
deps = DependencyManager()
projects = ProjectManager()
staffing = StaffingManager()
reads = TaskReadManager()
tree = TreeManager()
plans = PlanManager()


# ── Tasks ────────────────────────────────────────────────────────────────────


async def list_tasks(
    project: str | None = Query(default=None, description="Project key."),
    assignee: str | None = Query(default=None),
    task_status: list[str] | None = Query(default=None, alias="status"),
    parent: str | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskListResponse:
    project_id: str | None = None
    if project:
        project_id = (await projects.get_by_key(session, key=project, graph_id=graph.id)).id
    rows = await tasks.list_for_graph(
        session,
        graph_id=graph.id,
        project_id=project_id,
        assignee_id=assignee,
        status=task_status,
        parent_id=parent,
    )
    items = [await reads.compose(session, t) for t in rows]
    return TaskListResponse(items=items, total=len(items))


async def create_task(
    payload: TaskCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.create(session, graph=graph, payload=payload, actor=user)
    return await reads.compose(session, task)


async def get_task(
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    return await reads.compose(session, task)


async def update_task(
    payload: TaskUpdate,
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    task = await tasks.update(session, graph=graph, task=task, payload=payload, actor=user)
    return await reads.compose(session, task)


async def delete_task(
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    await tasks.cancel(session, graph=graph, task=task, actor=user)
    await session.delete(task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def start_task(
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    """A human picking up a task they were assigned. An agent's start is
    implicit in the assignment — it has nothing to click."""
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    if task.status != TaskStatus.blocked.value:
        task.status = TaskStatus.in_progress.value
    return await reads.compose(session, task)


async def post_result(
    payload: TaskResultRequest,
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    task = await tasks.post_result(
        session,
        graph=graph,
        task=task,
        payload=payload,
        actor_kind=ActorKind.user,
        actor_id=user.id,
        actor_name=user.username,
    )
    return await reads.compose(session, task)


async def accept_task(
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    task = await tasks.accept(session, graph=graph, task=task, actor=user)
    return await reads.compose(session, task)


async def reject_task(
    payload: TaskRejectRequest,
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    task = await tasks.reject(session, graph=graph, task=task, note=payload.note, actor=user)
    await tasks.reopen_dependants(session, task=task)
    return await reads.compose(session, task)


async def cancel_task(
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    task = await tasks.cancel(session, graph=graph, task=task, actor=user)
    return await reads.compose(session, task)


async def add_dependency(
    payload: DependencyCreate,
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    """The Plan canvas's one write. A cycle comes back as a 422 that **names
    the loop** — nothing is drawn, and the user can see why."""
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    await deps.add(session, graph=graph, task=task, payload=payload, actor=user)
    return await reads.compose(session, task)


async def remove_dependency(
    task_id: str = Path(...),
    depends_on_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id)
    await deps.remove(session, graph=graph, task=task, depends_on_id=depends_on_id, actor=user)
    return await reads.compose(session, task)


async def get_task_activity(
    task_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskActivityResponse:
    await tasks.get(session, task_id=task_id, graph_id=graph.id)
    return await tree.for_task(session, task_id=task_id)


# ── Projects ─────────────────────────────────────────────────────────────────


async def list_projects(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProjectListResponse:
    items = await projects.list_for_graph(session, graph_id=graph.id)
    return ProjectListResponse(items=items, total=len(items))


async def create_project(
    payload: ProjectCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProjectRead:
    project = await projects.create(session, graph_id=graph.id, payload=payload, actor=user)
    return await projects.read(session, project=project)


async def get_project(
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProjectRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    return await projects.read(session, project=project)


async def update_project(
    payload: ProjectUpdate,
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProjectRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    project = await projects.update(session, project=project, payload=payload, actor=user)
    return await projects.read(session, project=project)


async def delete_project(
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    await projects.delete(session, project=project, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def list_assignments(
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AssignmentListResponse:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    rows = await staffing.list_for_project(session, project=project)
    items = []
    for row, name in rows:
        read = AssignmentRead.model_validate(row)
        read.principal_name = name
        items.append(read)
    return AssignmentListResponse(items=items, total=len(items))


async def staff_project(
    payload: AssignmentCreate,
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AssignmentRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    row = await staffing.staff(session, project=project, payload=payload, actor=user)
    return AssignmentRead.model_validate(row)


async def unstaff_project(
    key: str = Path(...),
    assignment_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    await staffing.unstaff(session, project=project, assignment_id=assignment_id, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def project_plan(
    key: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProjectPlanResponse:
    """Waves, blocked-by, the critical path and the edges — one call, because
    the Plan tab and the Plan canvas are two renderings of the same fact."""
    project = await projects.get_by_key(session, key=key, graph_id=graph.id)
    return await plans.for_project(session, graph=graph, project=project)
