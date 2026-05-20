"""FastAPI dependencies — user resolution, superuser gate, workspace-scoped roles."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Path, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.jwt import InvalidTokenError, decode_access_token
from invana.auth.models import User, WorkspaceMember, WorkspaceRole
from invana.db import get_session

_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


# ---------------------------------------------------------------------------
# User-level dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Verify the access token, load the user, ensure they're active.

    Cached per-request on ``request.state`` so role deps don't re-hit the DB.
    """
    cached = getattr(request.state, "current_user", None)
    if cached is not None:
        return cached

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Missing bearer token.")

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError as e:
        raise _unauthorized(f"Invalid token: {e}") from e

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise _unauthorized("Token missing subject.")

    user = await session.get(User, user_id)
    if user is None:
        raise _unauthorized("User not found.")
    if not user.is_active:
        raise _forbidden("User is disabled.")

    request.state.current_user = user
    return user


async def require_superuser(user: User = Depends(get_current_user)) -> User:
    """Platform-level admin (gates starlette-admin)."""
    if not user.is_superuser:
        raise _forbidden("This action requires superuser privileges.")
    return user


# ---------------------------------------------------------------------------
# Workspace-scoped dependencies
# ---------------------------------------------------------------------------


async def get_workspace_membership(
    workspace_id: str = Path(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceMember:
    """Resolve the (workspace, user) -> WorkspaceMember row or 403."""
    stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id,
    )
    member = (await session.execute(stmt)).scalar_one_or_none()
    if member is None:
        raise _forbidden("You are not a member of this workspace.")
    return member


async def require_workspace_member(
    member: WorkspaceMember = Depends(get_workspace_membership),
) -> WorkspaceMember:
    """Any active member of the workspace."""
    return member


async def require_workspace_builder(
    member: WorkspaceMember = Depends(get_workspace_membership),
) -> WorkspaceMember:
    """admin or developer within the workspace — gates structure mutations."""
    if member.role not in (WorkspaceRole.admin, WorkspaceRole.developer):
        raise _forbidden("This action requires the developer or admin role in this workspace.")
    return member


async def require_workspace_admin(
    member: WorkspaceMember = Depends(get_workspace_membership),
) -> WorkspaceMember:
    """admin within the workspace — gates user/invitation/member mgmt."""
    if member.role is not WorkspaceRole.admin:
        raise _forbidden("This action requires the admin role in this workspace.")
    return member
