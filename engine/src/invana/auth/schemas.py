"""Pydantic request / response shapes for the /auth and graph-scoped APIs."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from invana.settings import settings

# ---------------------------------------------------------------------------
# Username
# ---------------------------------------------------------------------------

# Validation regex — lowercase, digits, hyphens; no leading/trailing hyphen.
# (Pydantic uses Rust regex which doesn't support look-ahead, so consecutive-hyphen
# rejection is enforced separately in the service-layer validator.)
USERNAME_PATTERN = r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
USERNAME_MIN = 2
USERNAME_MAX = 64


class UsernameAvailabilityResponse(BaseModel):
    available: bool
    # Populated only when available=False. Discriminates UI messaging.
    # Values: "taken" | "reserved" | "invalid_format".
    reason: str | None = None


# ---------------------------------------------------------------------------
# Graph membership shapes (denormalised onto the user payload)
# ---------------------------------------------------------------------------


class GraphMembershipOut(BaseModel):
    """A user's membership in a Graph — what /auth/me returns.

    Membership is binary (RFC-023); there is no role field.
    """

    graph_id: str
    graph_name: str
    graph_slug: str
    owner_username: str


# ---------------------------------------------------------------------------
# User payloads
# ---------------------------------------------------------------------------


class UserOut(BaseModel):
    """Returned by /auth/login, /auth/register, /auth/refresh, /auth/me."""

    id: str
    email: EmailStr
    username: str
    first_name: str
    last_name: str | None
    is_superuser: bool
    username_last_changed_at: datetime | None
    graphs: list[GraphMembershipOut]


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Register / login / refresh / logout
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    # Superuser-provisioned (RFC-023): the platform admin supplies the new
    # account's email directly (no invitation carries it anymore).
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    username: str = Field(min_length=USERNAME_MIN, max_length=USERNAME_MAX, pattern=USERNAME_PATTERN)
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
    # Optional; rate-limited at the service layer (cooldown).
    username: str | None = Field(
        default=None,
        min_length=USERNAME_MIN,
        max_length=USERNAME_MAX,
        pattern=USERNAME_PATTERN,
    )


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=settings.auth_min_password_length, max_length=1024)


class DeleteMeRequest(BaseModel):
    password: str
