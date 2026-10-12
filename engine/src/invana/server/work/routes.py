"""Paths for Work. Two routers, one product module (migration-plan §10).

``/api/v1/u/{username}/{graphSlug}/tasks``     — the task and its dependencies
``/api/v1/u/{username}/{graphSlug}/projects``  — the folder, staffing, the plan, and
                                               its branches, findings, decisions, proposals, report
``/api/v1/u/{username}/{graphSlug}/decisions`` — every decision in the Graph
``/api/v1/simulators``                         — the installed simulators; a project's
                                               simulations sit under its branches

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from invana.apps.work.schemas import (
    AssignmentListResponse,
    AssignmentRead,
    BranchDetail,
    BranchListResponse,
    DecisionListResponse,
    DecisionRead,
    FindingRead,
    ProjectListResponse,
    ProjectPlanResponse,
    ProjectRead,
    ProposalListResponse,
    ProposalRead,
    ReportRead,
    ReportVersionRead,
    SimulationListResponse,
    SimulationRead,
    SimulatorListResponse,
    TaskActivityResponse,
    TaskListResponse,
    TaskRead,
)
from invana.server.work import views

tasks_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/tasks", tags=["tasks"])

tasks_router.get("", response_model=TaskListResponse)(views.list_tasks)
tasks_router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)(views.create_task)
tasks_router.get("/{task_id}", response_model=TaskRead)(views.get_task)
tasks_router.patch("/{task_id}", response_model=TaskRead)(views.update_task)
tasks_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_task)
tasks_router.post("/{task_id}/start", response_model=TaskRead)(views.start_task)
tasks_router.post("/{task_id}/result", response_model=TaskRead)(views.post_result)
tasks_router.post("/{task_id}/accept", response_model=TaskRead)(views.accept_task)
tasks_router.post("/{task_id}/reject", response_model=TaskRead)(views.reject_task)
tasks_router.post("/{task_id}/cancel", response_model=TaskRead)(views.cancel_task)
tasks_router.post("/{task_id}/dependencies", response_model=TaskRead, status_code=status.HTTP_201_CREATED)(
    views.add_dependency
)
tasks_router.delete("/{task_id}/dependencies/{depends_on_id}", response_model=TaskRead)(views.remove_dependency)
tasks_router.get("/{task_id}/activity", response_model=TaskActivityResponse)(views.get_task_activity)


projects_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/projects", tags=["projects"])

projects_router.get("", response_model=ProjectListResponse)(views.list_projects)
projects_router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)(views.create_project)
projects_router.get("/{key}", response_model=ProjectRead)(views.get_project)
projects_router.patch("/{key}", response_model=ProjectRead)(views.update_project)
projects_router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_project)
projects_router.get("/{key}/assignments", response_model=AssignmentListResponse)(views.list_assignments)
projects_router.post("/{key}/assignments", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)(
    views.staff_project
)
projects_router.delete("/{key}/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)(
    views.unstaff_project
)
projects_router.get("/{key}/plan", response_model=ProjectPlanResponse)(views.project_plan)
projects_router.get("/{key}/branches", response_model=BranchListResponse)(views.list_branches)
projects_router.get("/{key}/branches/{number}", response_model=BranchDetail)(views.get_branch)
projects_router.post("/{key}/branches/{number}/fork", response_model=BranchListResponse, status_code=201)(
    views.fork_branch
)
projects_router.post("/{key}/branches/{number}/findings", response_model=FindingRead, status_code=201)(
    views.add_finding
)
projects_router.post("/{key}/branches/{number}/decisions", response_model=DecisionRead, status_code=201)(
    views.decide_branch
)
projects_router.post("/{key}/branches/{number}/proposals", response_model=ProposalRead, status_code=201)(
    views.submit_proposal
)
projects_router.get("/{key}/findings/{number}", response_model=FindingRead)(views.get_finding)
projects_router.post("/{key}/findings/{number}/review", response_model=FindingRead)(views.review_finding)
projects_router.get("/{key}/decisions", response_model=DecisionListResponse)(views.list_project_decisions)
projects_router.get("/{key}/proposals", response_model=ProposalListResponse)(views.list_proposals)
projects_router.post("/{key}/proposals/{number}/accept", response_model=ProposalRead)(views.accept_proposal)
projects_router.post("/{key}/proposals/{number}/reject", response_model=ProposalRead)(views.reject_proposal)
projects_router.get("/{key}/report", response_model=ReportRead)(views.get_report)
projects_router.put("/{key}/report", response_model=ReportRead)(views.edit_report)
projects_router.post("/{key}/report/generate", response_model=ReportRead)(views.generate_report)
projects_router.post("/{key}/report/publish", response_model=ReportVersionRead, status_code=201)(views.publish_report)
projects_router.get("/{key}/report/versions/{version}", response_model=ReportVersionRead)(views.get_report_version)
projects_router.get(
    "/{key}/report/versions/{version}/export",
    response_class=Response,
    responses={200: {"content": {"text/markdown": {}}}},
)(views.export_report_version)


decisions_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/decisions", tags=["projects"])

decisions_router.get("", response_model=DecisionListResponse)(views.list_decisions)


simulations_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/projects", tags=["simulations"])

simulations_router.post(
    "/{key}/branches/{number}/simulations", response_model=SimulationRead, status_code=status.HTTP_202_ACCEPTED
)(views.simulate)
simulations_router.get("/{key}/simulations", response_model=SimulationListResponse)(views.list_simulations)
simulations_router.get("/{key}/simulations/{number}", response_model=SimulationRead)(views.get_simulation)

simulators_router = APIRouter(prefix="/api/v1/simulators", tags=["simulations"])

simulators_router.get("", response_model=SimulatorListResponse)(views.list_simulators)
