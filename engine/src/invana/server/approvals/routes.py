"""Paths for approvals — ``/api/v1/u/{username}/{graphSlug}/approvals``.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter

from invana.activity.schemas import ApprovalPage, ApprovalRead
from invana.server.approvals import views

approvals_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/approvals", tags=["approvals"])

approvals_router.get("", response_model=ApprovalPage)(views.list_approvals)
approvals_router.get("/{approval_id}", response_model=ApprovalRead)(views.get_approval)
approvals_router.post("/{approval_id}/approve", response_model=ApprovalRead)(views.approve)
approvals_router.post("/{approval_id}/decline", response_model=ApprovalRead)(views.decline)

__all__ = ["approvals_router"]
