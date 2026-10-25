"""Paths for IAM, under ``/api/v1/u/{username}/{graphSlug}/iam``.

``policies`` · ``policies/{name}`` · ``…/save`` · ``…/versions`` · ``…/holders`` —
a Graph's policies and who holds them; ``policies/drafts`` — *Draft with the
assistant*; ``people`` · ``service-accounts`` — members and service accounts;
``groups`` · ``groups/{name}`` · ``…/members`` — groups and their members.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.iam.schemas import (
    GroupRead,
    GroupRow,
    HolderPage,
    HolderRow,
    PeoplePage,
    PersonRow,
    PolicyPage,
    PolicyRead,
    PolicyVersionRead,
)
from invana.core.lists import Page
from invana.server.iam import views

iam_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/iam", tags=["iam"])

_CREATED = status.HTTP_201_CREATED
_GONE = status.HTTP_204_NO_CONTENT

iam_router.get("/policies", response_model=PolicyPage)(views.list_policies)
iam_router.post("/policies", response_model=PolicyRead, status_code=_CREATED)(views.create_policy)
iam_router.post("/policies/drafts", response_model=PolicyRead, status_code=_CREATED)(views.draft_policy)
iam_router.get("/policies/{name}", response_model=PolicyRead)(views.get_policy)
iam_router.patch("/policies/{name}", response_model=PolicyRead)(views.update_policy)
iam_router.delete("/policies/{name}", status_code=_GONE)(views.delete_policy)
iam_router.post("/policies/{name}/save", response_model=PolicyRead)(views.save_policy)
iam_router.get("/policies/{name}/versions", response_model=list[PolicyVersionRead])(views.list_versions)
iam_router.get("/policies/{name}/holders", response_model=HolderPage)(views.list_holders)
iam_router.post("/policies/{name}/holders", response_model=HolderRow, status_code=_CREATED)(views.attach_holder)
iam_router.delete("/policies/{name}/holders/{attachment_id}", status_code=_GONE)(views.detach_holder)

iam_router.get("/people", response_model=PeoplePage)(views.list_people)
iam_router.post("/service-accounts", response_model=PersonRow, status_code=_CREATED)(views.create_service_account)

iam_router.get("/groups", response_model=Page[GroupRow])(views.list_groups)
iam_router.post("/groups", response_model=GroupRead, status_code=_CREATED)(views.create_group)
iam_router.get("/groups/{name}", response_model=GroupRead)(views.get_group)
iam_router.patch("/groups/{name}", response_model=GroupRead)(views.update_group)
iam_router.delete("/groups/{name}", status_code=_GONE)(views.delete_group)
iam_router.post("/groups/{name}/members", response_model=GroupRead, status_code=_CREATED)(views.add_group_member)
iam_router.delete("/groups/{name}/members/{member_id}", response_model=GroupRead)(views.remove_group_member)

__all__ = ["iam_router"]
