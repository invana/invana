"""Paths for alert rules — ``/api/v1/u/{username}/{graphSlug}/alert-rules``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.activity.schemas import AlertRuleRead
from invana.server.alerts import views

alerts_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/alert-rules", tags=["approvals"])

alerts_router.get("", response_model=list[AlertRuleRead])(views.list_rules)
alerts_router.post("", response_model=AlertRuleRead, status_code=status.HTTP_201_CREATED)(views.create_rule)
alerts_router.patch("/{rule_id}", response_model=AlertRuleRead)(views.update_rule)
alerts_router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_rule)

__all__ = ["alerts_router"]
