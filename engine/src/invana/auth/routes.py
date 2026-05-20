"""HTTP routes for /api/v1/auth/*.

Graph-scoped routes (members, invitations, connection) live in
:mod:`invana.graphs.routes`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth import services
from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.auth.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteMeRequest,
    LoginRequest,
    LogoutRequest,
    MePatchRequest,
    RefreshRequest,
    RegisterRequest,
    UsernameAvailabilityResponse,
    UserOut,
)
from invana.db import get_session

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
    return await services.check_username_availability(session, raw=username)


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


__all__ = ["auth_router"]
