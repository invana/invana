"""Paths for the plan library, under
``/api/v1/u/{username}/{graphSlug}/flows``.

``/{key}/tasks`` rather than ``/{key}/plan`` is deliberate: the plan **is** its
tasks, and *plan* is a word this model spends carefully
(task-model-migration §4).

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.flows.schemas import (
    FlowDetail,
    FlowPage,
    FlowRead,
    PlanPerformance,
    PlanRunsPage,
    PlanVersionDiff,
    TasksResponse,
)
from invana.server.flows import views

flows_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/flows", tags=["flows"])

flows_router.get("", response_model=FlowPage)(views.list_flows)
flows_router.get("/{key}", response_model=FlowDetail)(views.get_flow)
flows_router.get("/{key}/tasks", response_model=TasksResponse)(views.get_plan_tasks)
flows_router.get("/{key}/diff", response_model=PlanVersionDiff)(views.plan_diff)
flows_router.get("/{key}/performance", response_model=PlanPerformance)(views.plan_performance)
flows_router.get("/{key}/runs", response_model=PlanRunsPage)(views.plan_runs)
flows_router.get("/{key}/export")(views.export_flow)
flows_router.post("/promote", response_model=FlowRead, status_code=status.HTTP_201_CREATED)(views.promote)
