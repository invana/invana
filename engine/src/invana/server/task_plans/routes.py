"""Paths for the plan library, under
``/api/v1/u/{username}/{graphSlug}/task-plans``.

``/{key}/tasks`` rather than ``/{key}/plan`` is deliberate: the plan **is** its
tasks, and *plan* is a word this model spends carefully
(task-model-migration §4).

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.task_plans.schemas import (
    RunRow,
    TaskPlanDetail,
    TaskPlanListResponse,
    TaskPlanRead,
    TasksResponse,
)
from invana.server.task_plans import views

task_plans_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/task-plans", tags=["task-plans"])

task_plans_router.get("", response_model=TaskPlanListResponse)(views.list_workflows)
task_plans_router.get("/{key}", response_model=TaskPlanDetail)(views.get_workflow)
task_plans_router.get("/{key}/tasks", response_model=TasksResponse)(views.get_plan_tasks)
task_plans_router.get("/{key}/runs", response_model=list[RunRow])(views.workflow_runs)
task_plans_router.get("/{key}/export")(views.export_workflow)
task_plans_router.post("/promote", response_model=TaskPlanRead, status_code=status.HTTP_201_CREATED)(views.promote)
