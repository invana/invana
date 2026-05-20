"""HTTP routes for /api/v1/auth/* and /api/v1/workspaces/*."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth import services
from invana.auth.deps import (
    get_current_user,
    require_workspace_admin,
    require_workspace_member,
)
from invana.auth.models import User, WorkspaceMember
from invana.auth.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteMeRequest,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationOut,
    LoginRequest,
    LogoutRequest,
    MePatchRequest,
    RefreshRequest,
    RegisterRequest,
    UserOut,
    WorkspaceCreateRequest,
    WorkspaceMemberOut,
    WorkspaceMemberRoleUpdate,
    WorkspaceOut,
)
from invana.db import get_session

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
workspaces_router = APIRouter(prefix="/api/v1/workspaces", tags=["workspaces"])


# ---------------------------------------------------------------------------
# /api/v1/auth — registration, login, refresh, logout, me
# ---------------------------------------------------------------------------


@auth_router.post("/register", response_model=AuthResponse)
async def register(
    payload: RegisterRequest,
    invite: str = Query(..., description="Raw invitation token from the redeem URL."),
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    response = await services.register_with_invite(session, raw_invite_token=invite, payload=payload)
    await session.commit()
    return response


@auth_router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    response = await services.login(session, payload=payload)
    await session.commit()
    return response


@auth_router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    response = await services.refresh(session, raw_refresh=payload.refresh_token)
    await session.commit()
    return response


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, session: AsyncSession = Depends(get_session)) -> Response:
    await services.logout(session, raw_refresh=payload.refresh_token)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@auth_router.get("/me", response_model=UserOut)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    return await services.me_payload(session, user=user)


@auth_router.patch("/me", response_model=UserOut)
async def patch_me(
    payload: MePatchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    out = await services.patch_me(session, user=user, payload=payload)
    await session.commit()
    return out


@auth_router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.change_password(session, user=user, payload=payload)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@auth_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    payload: DeleteMeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.delete_me(session, user=user, payload=payload)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# /api/v1/workspaces — list, create
# ---------------------------------------------------------------------------


@workspaces_router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[WorkspaceOut]:
    return await services.list_my_workspaces(session, user=user)


@workspaces_router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceOut:
    out = await services.create_workspace(session, user=user, payload=payload)
    await session.commit()
    return out


# ---------------------------------------------------------------------------
# /api/v1/workspaces/{workspace_id}/members
# ---------------------------------------------------------------------------


@workspaces_router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberOut])
async def list_members(
    workspace_id: str = Path(...),
    _: WorkspaceMember = Depends(require_workspace_member),
    session: AsyncSession = Depends(get_session),
) -> list[WorkspaceMemberOut]:
    return await services.list_workspace_members(session, workspace_id=workspace_id)


@workspaces_router.patch("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberOut)
async def update_member_role(
    payload: WorkspaceMemberRoleUpdate,
    workspace_id: str = Path(...),
    user_id: str = Path(...),
    _: WorkspaceMember = Depends(require_workspace_admin),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceMemberOut:
    out = await services.update_workspace_member_role(
        session,
        workspace_id=workspace_id,
        target_user_id=user_id,
        payload=payload,
    )
    await session.commit()
    return out


@workspaces_router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: str = Path(...),
    user_id: str = Path(...),
    _: WorkspaceMember = Depends(require_workspace_admin),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.remove_workspace_member(session, workspace_id=workspace_id, target_user_id=user_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# /api/v1/workspaces/{workspace_id}/invitations
# ---------------------------------------------------------------------------


@workspaces_router.post(
    "/{workspace_id}/invitations",
    response_model=InvitationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    payload: InvitationCreateRequest,
    workspace_id: str = Path(...),
    _: WorkspaceMember = Depends(require_workspace_admin),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InvitationCreateResponse:
    out = await services.create_invitation(
        session,
        invited_by=user,
        workspace_id=workspace_id,
        payload=payload,
    )
    await session.commit()
    return out


@workspaces_router.get("/{workspace_id}/invitations", response_model=list[InvitationOut])
async def list_invitations(
    workspace_id: str = Path(...),
    _: WorkspaceMember = Depends(require_workspace_admin),
    session: AsyncSession = Depends(get_session),
) -> list[InvitationOut]:
    return await services.list_workspace_invitations(session, workspace_id=workspace_id)


@workspaces_router.delete(
    "/{workspace_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_invitation(
    workspace_id: str = Path(...),
    invitation_id: str = Path(...),
    _: WorkspaceMember = Depends(require_workspace_admin),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await services.delete_invitation(session, workspace_id=workspace_id, invitation_id=invitation_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["auth_router", "workspaces_router"]
