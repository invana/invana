"""Business logic for auth + workspace lifecycle.

Functions return raw DTOs or raise ``HTTPException``. They flush but do
not commit — the route handler commits once at the end of the request.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.auth import jwt as jwt_codec
from invana.auth.models import (
    Invitation,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceRole,
)
from invana.auth.passwords import WeakPasswordError, hash_password, verify_password
from invana.auth.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteMeRequest,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationOut,
    LoginRequest,
    MePatchRequest,
    RegisterRequest,
    UserOut,
    WorkspaceCreateRequest,
    WorkspaceMemberOut,
    WorkspaceMemberRoleUpdate,
    WorkspaceMembershipOut,
    WorkspaceOut,
)
from invana.auth.tokens import (
    find_active_refresh_token,
    generate_token,
    hash_token,
    issue_refresh_token,
    revoke_all_refresh_tokens_for_user,
    revoke_refresh_token,
)
from invana.settings import settings

_GENERIC_AUTH_FAILURE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password.",
)


# ---------------------------------------------------------------------------
# Auth-response building (loads memberships)
# ---------------------------------------------------------------------------


async def _list_memberships(session: AsyncSession, *, user_id: str) -> list[WorkspaceMembershipOut]:
    stmt = (
        select(WorkspaceMember)
        .where(WorkspaceMember.user_id == user_id)
        .options(selectinload(WorkspaceMember.workspace))
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [
        WorkspaceMembershipOut(
            workspace_id=m.workspace_id,
            workspace_name=m.workspace.name,
            workspace_slug=m.workspace.slug,
            role=m.role,
        )
        for m in rows
    ]


async def _user_out(session: AsyncSession, *, user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_superuser=user.is_superuser,
        workspaces=await _list_memberships(session, user_id=user.id),
    )


async def _build_auth_response(session: AsyncSession, *, user: User) -> AuthResponse:
    access = jwt_codec.encode_access_token(user_id=user.id, is_superuser=user.is_superuser)
    refresh = await issue_refresh_token(session, user_id=user.id)
    return AuthResponse(
        user=await _user_out(session, user=user),
        access_token=access,
        refresh_token=refresh,
    )


# ---------------------------------------------------------------------------
# Registration via workspace-scoped invitation
# ---------------------------------------------------------------------------


async def register_with_invite(
    session: AsyncSession, *, raw_invite_token: str, payload: RegisterRequest
) -> AuthResponse:
    invitation = await _find_invitation_by_raw_token(session, raw_invite_token)
    if invitation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    if invitation.accepted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Invitation already accepted.")
    if invitation.expires_at <= datetime.now(UTC):
        raise HTTPException(status.HTTP_410_GONE, detail="Invitation has expired.")

    # If a user with this email already exists, accepting the invite just
    # creates the workspace membership — we don't try to set a new password.
    existing_user = await _find_user_by_email(session, invitation.email)
    if existing_user is None:
        try:
            password_hash = hash_password(payload.password)
        except WeakPasswordError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

        user = User(
            email=invitation.email.lower(),
            password_hash=password_hash,
            first_name=payload.first_name.strip(),
            last_name=(payload.last_name.strip() if payload.last_name else None) or None,
            is_superuser=False,
            is_active=True,
        )
        session.add(user)
        await session.flush()
    else:
        # Email already known — registration is a no-op on the user record;
        # we still attach the new workspace membership.
        user = existing_user

    # Attach (or upgrade) the workspace membership.
    member = await _get_membership(session, workspace_id=invitation.workspace_id, user_id=user.id)
    if member is None:
        session.add(
            WorkspaceMember(
                workspace_id=invitation.workspace_id,
                user_id=user.id,
                role=invitation.role,
            )
        )
    else:
        member.role = invitation.role

    invitation.accepted_at = datetime.now(UTC)
    await session.flush()
    return await _build_auth_response(session, user=user)


# ---------------------------------------------------------------------------
# Login / refresh / logout
# ---------------------------------------------------------------------------


async def login(session: AsyncSession, *, payload: LoginRequest) -> AuthResponse:
    user = await _find_user_by_email(session, payload.email)
    if user is None or not user.is_active:
        verify_password(payload.password, "$2b$12$" + "x" * 53)
        raise _GENERIC_AUTH_FAILURE
    if not verify_password(payload.password, user.password_hash):
        raise _GENERIC_AUTH_FAILURE
    return await _build_auth_response(session, user=user)


async def refresh(session: AsyncSession, *, raw_refresh: str) -> AuthResponse:
    row = await find_active_refresh_token(session, raw_token=raw_refresh)
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")
    await revoke_refresh_token(session, raw_token=raw_refresh)
    user = await session.get(User, row.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")
    return await _build_auth_response(session, user=user)


async def logout(session: AsyncSession, *, raw_refresh: str) -> None:
    await revoke_refresh_token(session, raw_token=raw_refresh)


# ---------------------------------------------------------------------------
# /auth/me — get, patch, change password, delete
# ---------------------------------------------------------------------------


async def me_payload(session: AsyncSession, *, user: User) -> UserOut:
    return await _user_out(session, user=user)


async def patch_me(session: AsyncSession, *, user: User, payload: MePatchRequest) -> UserOut:
    raw = payload.model_dump(exclude_unset=True)
    if "first_name" in raw:
        first = (raw["first_name"] or "").strip()
        if not first:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="first_name cannot be empty.",
            )
        user.first_name = first
    if "last_name" in raw:
        last = raw["last_name"]
        user.last_name = last.strip() if (last and last.strip()) else None
    await session.flush()
    return await _user_out(session, user=user)


async def change_password(session: AsyncSession, *, user: User, payload: ChangePasswordRequest) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")
    try:
        user.password_hash = hash_password(payload.new_password)
    except WeakPasswordError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    await revoke_all_refresh_tokens_for_user(session, user_id=user.id)


async def delete_me(session: AsyncSession, *, user: User, payload: DeleteMeRequest) -> None:
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect.")
    if user.is_superuser and await _is_sole_active_superuser(session, user_id=user.id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=("You are the only superuser. Promote another user before deleting this account."),
        )
    await session.delete(user)


async def _is_sole_active_superuser(session: AsyncSession, *, user_id: str) -> bool:
    stmt = select(func.count(User.id)).where(
        User.is_superuser.is_(True),
        User.is_active.is_(True),
        User.id != user_id,
    )
    return (await session.execute(stmt)).scalar_one() == 0


# ---------------------------------------------------------------------------
# Workspaces
# ---------------------------------------------------------------------------


async def create_workspace(session: AsyncSession, *, user: User, payload: WorkspaceCreateRequest) -> WorkspaceOut:
    slug = payload.slug.lower()
    existing = (await session.execute(select(Workspace).where(Workspace.slug == slug))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A workspace with this slug already exists.")
    workspace = Workspace(name=payload.name.strip(), slug=slug, created_by_id=user.id)
    session.add(workspace)
    await session.flush()
    session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.admin))
    await session.flush()
    return WorkspaceOut.model_validate(workspace)


async def list_my_workspaces(session: AsyncSession, *, user: User) -> list[WorkspaceOut]:
    stmt = (
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
        .order_by(Workspace.created_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [WorkspaceOut.model_validate(w) for w in rows]


async def list_workspace_members(session: AsyncSession, *, workspace_id: str) -> list[WorkspaceMemberOut]:
    stmt = (
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .options(selectinload(WorkspaceMember.user))
        .order_by(WorkspaceMember.created_at.asc())
    )
    return [
        WorkspaceMemberOut(
            user_id=m.user_id,
            email=m.user.email,
            first_name=m.user.first_name,
            last_name=m.user.last_name,
            role=m.role,
            created_at=m.created_at,
        )
        for m in (await session.execute(stmt)).scalars().all()
    ]


async def update_workspace_member_role(
    session: AsyncSession,
    *,
    workspace_id: str,
    target_user_id: str,
    payload: WorkspaceMemberRoleUpdate,
) -> WorkspaceMemberOut:
    member = await _get_membership(session, workspace_id=workspace_id, user_id=target_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    if (
        member.role is WorkspaceRole.admin
        and payload.role is not WorkspaceRole.admin
        and await _is_sole_workspace_admin(session, workspace_id=workspace_id, user_id=target_user_id)
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot demote the only admin of this workspace.",
        )
    member.role = payload.role
    await session.flush()
    await session.refresh(member, ["user"])
    return WorkspaceMemberOut(
        user_id=member.user_id,
        email=member.user.email,
        first_name=member.user.first_name,
        last_name=member.user.last_name,
        role=member.role,
        created_at=member.created_at,
    )


async def remove_workspace_member(session: AsyncSession, *, workspace_id: str, target_user_id: str) -> None:
    member = await _get_membership(session, workspace_id=workspace_id, user_id=target_user_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Member not found.")
    if member.role is WorkspaceRole.admin and await _is_sole_workspace_admin(
        session, workspace_id=workspace_id, user_id=target_user_id
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Cannot remove the only admin of this workspace.",
        )
    await session.delete(member)


async def _is_sole_workspace_admin(session: AsyncSession, *, workspace_id: str, user_id: str) -> bool:
    stmt = select(func.count()).where(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.role == WorkspaceRole.admin,
        WorkspaceMember.user_id != user_id,
    )
    return (await session.execute(stmt)).scalar_one() == 0


# ---------------------------------------------------------------------------
# Invitations (workspace-scoped)
# ---------------------------------------------------------------------------


async def create_invitation(
    session: AsyncSession,
    *,
    invited_by: User,
    workspace_id: str,
    payload: InvitationCreateRequest,
) -> InvitationCreateResponse:
    raw_token = generate_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.auth_invitation_ttl_days)
    invitation = Invitation(
        token_hash=hash_token(raw_token),
        email=payload.email.lower(),
        workspace_id=workspace_id,
        role=payload.role,
        invited_by_id=invited_by.id,
        expires_at=expires_at,
    )
    session.add(invitation)
    await session.flush()

    return InvitationCreateResponse(
        id=invitation.id,
        email=invitation.email,
        workspace_id=invitation.workspace_id,
        role=invitation.role,
        invited_by_id=invitation.invited_by_id,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        created_at=invitation.created_at,
        redeem_url=_redeem_url(raw_token),
    )


async def list_workspace_invitations(session: AsyncSession, *, workspace_id: str) -> list[InvitationOut]:
    stmt = select(Invitation).where(Invitation.workspace_id == workspace_id).order_by(Invitation.created_at.desc())
    return [InvitationOut.model_validate(r) for r in (await session.execute(stmt)).scalars().all()]


async def delete_invitation(session: AsyncSession, *, workspace_id: str, invitation_id: str) -> None:
    invitation = await session.get(Invitation, invitation_id)
    if invitation is None or invitation.workspace_id != workspace_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    await session.delete(invitation)


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------


async def _find_user_by_email(session: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(func.lower(User.email) == email.lower())
    return (await session.execute(stmt)).scalar_one_or_none()


async def _get_membership(session: AsyncSession, *, workspace_id: str, user_id: str) -> WorkspaceMember | None:
    stmt = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _find_invitation_by_raw_token(session: AsyncSession, raw_token: str) -> Invitation | None:
    stmt = select(Invitation).where(Invitation.token_hash == hash_token(raw_token))
    return (await session.execute(stmt)).scalar_one_or_none()


def _redeem_url(raw_token: str) -> str:
    base = settings.studio_base_url.rstrip("/")
    return f"{base}/register?invite={raw_token}"


# ---------------------------------------------------------------------------
# Bootstrap (called by `invana init`)
# ---------------------------------------------------------------------------


async def bootstrap_root(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str | None,
    workspace_name: str,
    workspace_slug: str,
) -> tuple[User, Workspace]:
    """Create the root superuser + their personal workspace + admin membership.

    Idempotent guard at the call site: refuse if any superuser already exists.
    """
    password_hash = hash_password(password)
    user = User(
        email=email.lower(),
        password_hash=password_hash,
        first_name=first_name.strip(),
        last_name=(last_name.strip() if last_name else None) or None,
        is_superuser=True,
        is_active=True,
    )
    session.add(user)
    await session.flush()

    workspace = Workspace(
        name=workspace_name.strip(),
        slug=workspace_slug.lower(),
        created_by_id=user.id,
    )
    session.add(workspace)
    await session.flush()

    session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.admin))
    await session.flush()
    return user, workspace


async def any_superuser_exists(session: AsyncSession) -> bool:
    stmt = select(func.count(User.id)).where(User.is_superuser.is_(True))
    return (await session.execute(stmt)).scalar_one() > 0
