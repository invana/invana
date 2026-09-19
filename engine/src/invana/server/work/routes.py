"""Paths for Work. Two routers, one product module (migration-plan §10).

``/api/v1/u/{username}/{graphSlug}/tasks``     — the task and its dependencies
``/api/v1/u/{username}/{graphSlug}/projects``  — the folder, staffing, the plan

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.work.schemas import (
    AssignmentListResponse,
    AssignmentRead,
    ProjectListResponse,
    ProjectPlanResponse,
    ProjectRead,
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
