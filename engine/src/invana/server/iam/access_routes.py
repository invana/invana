"""Paths for IAM's runtime reads — ``/api/v1/u/{username}/{graphSlug}/iam``.

The reads that compose the runtime: the IAM home, every agent's effective
access and refusals, Test access, a policy's impact and its limits in use.
Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.apps.iam.schemas import (
    AccessCheckRead,
    AgentAccessPage,
    EffectiveRead,
    ImpactRead,
    LimitsRead,
    OverviewRead,
)
from invana.core.ledger.schemas import LedgerRowRead
from invana.core.lists import Page
from invana.server.iam import access_views as views

access_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/iam", tags=["iam"])

access_router.get("/overview", response_model=OverviewRead)(views.get_overview)
access_router.get("/agents", response_model=AgentAccessPage)(views.list_agents)
access_router.get("/agents/{agent_id}/effective", response_model=EffectiveRead)(views.get_effective)
access_router.get("/agents/{agent_id}/refusals", response_model=Page[LedgerRowRead])(views.list_refusals)
access_router.post("/test", response_model=AccessCheckRead)(views.test_access)
access_router.post("/policies/{name}/impact", response_model=ImpactRead)(views.policy_impact)
access_router.get("/policies/{name}/limits", response_model=LimitsRead)(views.policy_limits)

__all__ = ["access_router"]
