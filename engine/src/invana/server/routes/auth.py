"""HTTP routes for /api/v1/auth/*.

Graph-scoped routes (members, connection) live in
:mod:`invana.apps.graphs.routes`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.deps import get_current_user, require_session_auth, require_superuser
from invana.core.auth.managers import AuthManager
from invana.core.auth.models import User
from invana.core.auth.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteMeRequest,
    LoginRequest,
    LogoutRequest,
    MePatchRequest,
    PersonalAccessTokenCreated,
    PersonalAccessTokenCreateRequest,
    PersonalAccessTokenList,
    RefreshRequest,
    RegisterRequest,
    UsernameAvailabilityResponse,
    UserOut,
)
from invana.core.db import get_session

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@auth_router.get("/username-available", response_model=UsernameAvailabilityResponse)
async def username_available(
    username: str = Query(..., min_length=1, max_length=128),
    session: AsyncSession = Depends(get_session),
) -> UsernameAvailabilityResponse:
    """Advisory check used by Studio's live-availability indicator.

    Unauthenticated. Final uniqueness is enforced at register / PATCH time —
    clients must not treat ``available=true`` as a reservation. The endpoint
    is rate-limited per IP at the gateway layer (see settings).
    """
    return await AuthManager().check_username_availability(session, raw=username)


@auth_router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    actor: User = Depends(require_superuser),
    _session_only: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    """Provision a new account. Superuser-only (docs/for-developers/modules/identity-and-access/features/membership.md)
    — self-service signup removed."""
    out = await AuthManager().register(session, payload=payload, actor_id=actor.id)
    await session.commit()
    return out


@auth_router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    response = await AuthManager().login(session, payload=payload)
    await session.commit()
    return response


@auth_router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    response = await AuthManager().refresh(session, raw_refresh=payload.refresh_token)
    await session.commit()
    return response


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, session: AsyncSession = Depends(get_session)) -> Response:
    await AuthManager().logout(session, raw_refresh=payload.refresh_token)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@auth_router.get("/me", response_model=UserOut)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    return await AuthManager().me_payload(session, user=user)


@auth_router.patch("/me", response_model=UserOut)
async def patch_me(
    payload: MePatchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    out = await AuthManager().patch_me(session, user=user, payload=payload)
    await session.commit()
    return out


@auth_router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await AuthManager().change_password(session, user=user, payload=payload)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@auth_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    payload: DeleteMeRequest,
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await AuthManager().delete_me(session, user=user, payload=payload)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Personal access tokens
# (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md)
#
# Every route here is session-only: a token cannot mint or revoke a token (PT4).
# ---------------------------------------------------------------------------


@auth_router.get("/me/tokens", response_model=PersonalAccessTokenList)
async def list_tokens(
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> PersonalAccessTokenList:
    """The tokens this person holds, with what the deployment allows.

    Revoked rows are gone from the list; an expired one stays, marked, so it can
    explain what stopped working (PT7).
    """
    return await AuthManager().list_personal_access_tokens(session, user=user)


@auth_router.post("/me/tokens", response_model=PersonalAccessTokenCreated, status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: PersonalAccessTokenCreateRequest,
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> PersonalAccessTokenCreated:
    """Mint a token. The response carries the secret — the only time it exists
    outside the caller's hands (PT2)."""
    created = await AuthManager().create_personal_access_token(session, user=user, payload=payload)
    await session.commit()
    return created


@auth_router.delete("/me/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(
    token_id: str,
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await AuthManager().revoke_personal_access_token(session, user=user, token_id=token_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["auth_router"]
