"""Paths for a Graph's members and the caller's access.

``/api/v1/u/{username}/{graphSlug}/members``   — the members, with their roles
``/api/v1/u/{username}/{graphSlug}/access``    — what the caller may change

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.graphs.schemas import AccessRead, MemberListResponse, MemberRead
from invana.server.members import views

members_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}", tags=["members"])

members_router.get("/members", response_model=MemberListResponse)(views.list_members)
members_router.post("/members", response_model=MemberRead, status_code=status.HTTP_201_CREATED)(views.add_member)
members_router.patch("/members/{member}", response_model=MemberRead)(views.update_member)
members_router.delete("/members/{member}", status_code=status.HTTP_204_NO_CONTENT)(views.remove_member)
members_router.get("/access", response_model=AccessRead)(views.get_access)

__all__ = ["members_router"]
