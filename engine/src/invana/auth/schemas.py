"""Pydantic request / response shapes for the /auth and /workspaces APIs."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from invana.auth.models import WorkspaceRole
from invana.settings import settings

# ---------------------------------------------------------------------------
# Workspace membership shapes (denormalised onto the user payload)
# ---------------------------------------------------------------------------


class WorkspaceMembershipOut(BaseModel):
    """A user's membership in a workspace — what /auth/me returns."""

    workspace_id: str
    workspace_name: str
    workspace_slug: str
    role: WorkspaceRole


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    created_by_id: str | None
    created_at: datetime
    updated_at: datetime


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=255, pattern=r"^[a-z0-9][a-z0-9-]*$")


class WorkspaceMemberOut(BaseModel):
    """A row in /workspaces/{wid}/members."""

    user_id: str
    email: EmailStr
    first_name: str
    last_name: str | None
    role: WorkspaceRole
    created_at: datetime


class WorkspaceMemberRoleUpdate(BaseModel):
    role: WorkspaceRole


# ---------------------------------------------------------------------------
# User payloads
# ---------------------------------------------------------------------------


class UserOut(BaseModel):
    """Returned by /auth/login, /auth/register, /auth/refresh, /auth/me."""

    id: str
    email: EmailStr
    first_name: str
    last_name: str | None
    is_superuser: bool
    workspaces: list[WorkspaceMembershipOut]


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Register / login / refresh / logout
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    password: str = Field(min_length=settings.auth_min_password_length, max_length=1024)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Me — patch / change password / delete
# ---------------------------------------------------------------------------


class MePatchRequest(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    # Explicit-null is allowed — clients can pass {"last_name": null} to clear it.
    last_name: str | None = Field(default=None, max_length=120)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=settings.auth_min_password_length, max_length=1024)


class DeleteMeRequest(BaseModel):
    password: str


# ---------------------------------------------------------------------------
# Invitations (workspace-scoped)
# ---------------------------------------------------------------------------


class InvitationCreateRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    workspace_id: str
    role: WorkspaceRole
    invited_by_id: str | None
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime


class InvitationCreateResponse(InvitationOut):
    """Returned once at create time — includes the one-shot redeem URL."""

    redeem_url: str
