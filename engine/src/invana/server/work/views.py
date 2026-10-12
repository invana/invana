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
    BranchManager,
    DecisionManager,
    DependencyManager,
    PlanManager,
    ProjectManager,
    ProposalManager,
    ReportManager,
    StaffingManager,
    TaskManager,
)
from invana.apps.work.models import Project, TaskStatus
from invana.apps.work.schemas import (
    AssignmentCreate,
    AssignmentListResponse,
    AssignmentRead,
    BranchDetail,
    BranchFork,
    BranchListResponse,
    DecisionCreate,
    DecisionListResponse,
    DecisionRead,
    DependencyCreate,
    FindingCreate,
    FindingRead,
    ProjectCreate,
    ProjectListResponse,
    ProjectPlanResponse,
    ProjectRead,
    ProjectUpdate,
    ProposalCreate,
    ProposalListResponse,
    ProposalRead,
    ProposalResolve,
    ReportDraftUpdate,
    ReportRead,
    ReportVersionRead,
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
branches = BranchManager()
decisions = DecisionManager()
proposals = ProposalManager()
reports = ReportManager()


# ── Tasks ────────────────────────────────────────────────────────────────────


async def list_tasks(
    project: str | None = Query(default=None, description="Project key."),
    assignee: str | None = Query(default=None),
    task_status: list[str] | None = Query(default=None, alias="status"),
    parent: str | None = Query(default=None),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskListResponse:
    project_id: str | None = None
    if project:
        project_id = (await projects.get_by_key(session, key=project, graph_id=graph.id, reader_id=member.user_id)).id
    rows = await tasks.list_for_graph(
        session,
        reader_id=member.user_id,
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
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.create(session, graph=graph, payload=payload, actor=user)
    return await reads.compose(session, task)


async def get_task(
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    return await reads.compose(session, task)


async def update_task(
    payload: TaskUpdate,
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    task = await tasks.update(session, graph=graph, task=task, payload=payload, actor=user)
    return await reads.compose(session, task)


async def delete_task(
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    await tasks.cancel(session, graph=graph, task=task, actor=user)
    await session.delete(task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def start_task(
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    """A human picking up a task they were assigned. An agent's start is
    implicit in the assignment — it has nothing to click."""
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    if task.status != TaskStatus.blocked.value:
        task.status = TaskStatus.in_progress.value
    return await reads.compose(session, task)


async def post_result(
    payload: TaskResultRequest,
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
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
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    task = await tasks.accept(session, graph=graph, task=task, actor=user)
    return await reads.compose(session, task)


async def reject_task(
    payload: TaskRejectRequest,
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    task = await tasks.reject(session, graph=graph, task=task, note=payload.note, actor=user)
    await tasks.reopen_dependants(session, task=task)
    return await reads.compose(session, task)


async def cancel_task(
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    task = await tasks.cancel(session, graph=graph, task=task, actor=user)
    return await reads.compose(session, task)


async def add_dependency(
    payload: DependencyCreate,
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    """The Plan canvas's one write. A cycle comes back as a 422 that **names
    the loop** — nothing is drawn, and the user can see why."""
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    await deps.add(session, graph=graph, task=task, payload=payload, actor=user)
    return await reads.compose(session, task)


async def remove_dependency(
    task_id: str = Path(...),
    depends_on_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    task = await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    await deps.remove(session, graph=graph, task=task, depends_on_id=depends_on_id, actor=user)
    return await reads.compose(session, task)


async def get_task_activity(
    task_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> TaskActivityResponse:
    await tasks.get(session, task_id=task_id, graph_id=graph.id, reader_id=member.user_id)
    return await tree.for_task(session, task_id=task_id)


# ── Projects ─────────────────────────────────────────────────────────────────


async def list_projects(
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProjectListResponse:
    items = await projects.list_for_graph(session, graph_id=graph.id, reader_id=member.user_id)
    return ProjectListResponse(items=items, total=len(items))


async def create_project(
    payload: ProjectCreate,
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProjectRead:
    project = await projects.create(session, graph_id=graph.id, payload=payload, actor=user)
    return await projects.read(session, project=project)


async def get_project(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProjectRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    return await projects.read(session, project=project)


async def update_project(
    payload: ProjectUpdate,
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProjectRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    project = await projects.update(session, project=project, payload=payload, actor=user)
    return await projects.read(session, project=project)


async def delete_project(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    await projects.delete(session, project=project, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def list_assignments(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> AssignmentListResponse:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
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
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AssignmentRead:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    row = await staffing.staff(session, project=project, payload=payload, actor=user)
    return AssignmentRead.model_validate(row)


async def unstaff_project(
    key: str = Path(...),
    assignment_id: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    await staffing.unstaff(session, project=project, assignment_id=assignment_id, actor=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def project_plan(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProjectPlanResponse:
    """Waves, blocked-by, the critical path and the edges — one call, because
    the Plan tab and the Plan canvas are two renderings of the same fact."""
    project = await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)
    return await plans.for_project(session, graph=graph, project=project)


# ── Project records — branches, findings, decisions, proposals, the report ──


async def _project(session: AsyncSession, graph: Graph, member: GraphMember, key: str) -> Project:
    return await projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=member.user_id)


async def list_branches(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BranchListResponse:
    project = await _project(session, graph, member, key)
    items = await branches.list(session, project=project)
    return BranchListResponse(items=items, total=len(items))


async def get_branch(
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> BranchDetail:
    """The branch page in one call: the branch, its evidence, decisions, proposals and children."""
    project = await _project(session, graph, member, key)
    branch = await branches.get(session, project=project, number=number)
    return BranchDetail(
        branch=(await branches.read(session, [branch]))[0],
        findings=await branches.findings(session, branch=branch),
        decisions=await decisions.list_for_branch(session, project=project, branch=branch),
        proposals=await proposals.list(session, project=project, branch=branch),
        children=await branches.children(session, project=project, branch=branch),
    )


async def fork_branch(
    payload: BranchFork,
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BranchListResponse:
    project = await _project(session, graph, member, key)
    branch = await branches.get(session, project=project, number=number)
    children = await branches.fork(session, project=project, branch=branch, titles=payload.titles, actor=user)
    items = await branches.read(session, children)
    return BranchListResponse(items=items, total=len(items))


async def add_finding(
    payload: FindingCreate,
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FindingRead:
    project = await _project(session, graph, member, key)
    branch = await branches.get(session, project=project, number=number)
    finding = await branches.add_finding(
        session,
        graph_id=graph.id,
        project=project,
        branch=branch,
        payload=payload,
        actor=user,
        agent_id=payload.agent_id,
    )
    return await branches.finding_read(session, finding)


async def get_finding(
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> FindingRead:
    project = await _project(session, graph, member, key)
    return await branches.finding_read(session, await branches.get_finding(session, project=project, number=number))


async def review_finding(
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FindingRead:
    project = await _project(session, graph, member, key)
    finding = await branches.get_finding(session, project=project, number=number)
    return await branches.finding_read(
        session, await branches.review(session, project=project, finding=finding, actor=user)
    )


async def decide_branch(
    payload: DecisionCreate,
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DecisionRead:
    """A verdict and a decision, checked by every rule in force. Only a person decides."""
    project = await _project(session, graph, member, key)
    branch = await branches.get(session, project=project, number=number)
    decision = await decisions.decide(session, project=project, branch=branch, payload=payload, actor=user)
    return (await decisions.read(session, [decision]))[0]


async def list_project_decisions(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> DecisionListResponse:
    project = await _project(session, graph, member, key)
    items = await decisions.list_for_graph(session, graph_id=graph.id, reader_id=member.user_id, project=project)
    return DecisionListResponse(items=items, total=len(items))


async def list_decisions(
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> DecisionListResponse:
    """Every decision in the Graph the reader may see, newest first — the Decisions rail item."""
    items = await decisions.list_for_graph(session, graph_id=graph.id, reader_id=member.user_id)
    return DecisionListResponse(items=items, total=len(items))


async def submit_proposal(
    payload: ProposalCreate,
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProposalRead:
    project = await _project(session, graph, member, key)
    branch = await branches.get(session, project=project, number=number)
    row = await proposals.submit(
        session, graph_id=graph.id, project=project, branch=branch, payload=payload, actor=user
    )
    return await proposals.read(session, row)


async def list_proposals(
    key: str = Path(...),
    proposal_status: str | None = Query(default=None, alias="status", pattern=r"^(open|accepted|rejected)$"),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ProposalListResponse:
    project = await _project(session, graph, member, key)
    items = await proposals.list(session, project=project, status=proposal_status)
    return ProposalListResponse(items=items, total=len(items))


async def accept_proposal(
    payload: ProposalResolve,
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProposalRead:
    """Do what the agent proposed, as this person — a decision runs the full rule check."""
    project = await _project(session, graph, member, key)
    row = await proposals.get(session, project=project, number=number)
    row = await proposals.accept(session, project=project, proposal=row, note=payload.note, actor=user)
    return await proposals.read(session, row)


async def reject_proposal(
    payload: ProposalResolve,
    key: str = Path(...),
    number: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProposalRead:
    project = await _project(session, graph, member, key)
    row = await proposals.get(session, project=project, number=number)
    row = await proposals.reject(session, project=project, proposal=row, note=payload.note, actor=user)
    return await proposals.read(session, row)


async def get_report(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ReportRead:
    project = await _project(session, graph, member, key)
    return await reports.read(session, project=project)


async def edit_report(
    payload: ReportDraftUpdate,
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReportRead:
    project = await _project(session, graph, member, key)
    return await reports.edit(session, project=project, draft=payload.draft, actor=user)


async def generate_report(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReportRead:
    """Replace the draft with one drawn from the records — nothing invented."""
    project = await _project(session, graph, member, key)
    return await reports.generate(session, project=project, actor=user)


async def publish_report(
    key: str = Path(...),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReportVersionRead:
    project = await _project(session, graph, member, key)
    version = await reports.publish(session, project=project, actor=user)
    return await reports.version(session, project=project, number=version.version)


async def get_report_version(
    key: str = Path(...),
    version: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ReportVersionRead:
    project = await _project(session, graph, member, key)
    return await reports.version(session, project=project, number=version)


async def export_report_version(
    key: str = Path(...),
    version: int = Path(..., ge=1),
    member: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """The version as Markdown, with the retraction notice above it when one applies."""
    project = await _project(session, graph, member, key)
    read = await reports.version(session, project=project, number=version)
    notice = f"> Cites retracted data: {', '.join(read.retracted)}.\n\n" if read.retracted else ""
    return Response(
        content=notice + read.body,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{project.key}-report-v{version}.md"'},
    )
