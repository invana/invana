"""FastAPI dependencies — user resolution, the session gate and the superuser gate.

A request arrives with one of two credentials, and both resolve to the same
person: a short-lived access token (a JWT), or a personal access token
(docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
Neither carries membership — that is looked up per request (IA2).

Graph-scoped deps (membership, role gates) live in :mod:`invana.server.graphs.deps`.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.jwt import InvalidTokenError, decode_access_token
from invana.core.auth.models import User
from invana.core.auth.tokens import (
    PersonalAccessTokenRefusal,
    is_personal_access_token,
    resolve_personal_access_token,
    should_touch_last_used,
)
from invana.core.db import get_session
from invana.core.events import actions as event_actions
from invana.core.events.models import ActorType
from invana.core.events.services import current_trace_id, emit_event

_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Verify the access token, load the user, ensure they're active.

    Cached per-request on ``request.state`` so role deps don't re-hit the DB.

    Token source: the ``Authorization: Bearer <jwt>`` header is the default
    and required path for normal API calls. As a narrow fallback for SSE
    endpoints (browsers' ``EventSource`` API doesn't allow custom headers),
    a ``?token=<jwt>`` query parameter is also accepted. The header takes
    precedence when both are present.
    """
    cached = getattr(request.state, "current_user", None)
    if cached is not None:
        return cached

    raw_token: str | None = None
    if credentials is not None and credentials.scheme.lower() == "bearer":
        raw_token = credentials.credentials
    else:
        # SSE fallback — only consulted when no Authorization header was sent.
        query_token = request.query_params.get("token")
        if query_token:
            raw_token = query_token

    if not raw_token:
        raise _unauthorized("Missing bearer token.")

    if is_personal_access_token(raw_token):
        # A long-lived secret is never read from the query string (PT5) — the
        # `?token=` fallback above is an access-token path only.
        if credentials is None:
            raise _unauthorized("Personal access tokens are accepted in the Authorization header only.")
        user = await _user_from_personal_access_token(request, session, raw_token=raw_token)
        request.state.current_user = user
        return user

    try:
        payload = decode_access_token(raw_token)
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


async def _user_from_personal_access_token(request: Request, session: AsyncSession, *, raw_token: str) -> User:
    """Resolve a personal access token to its owner, or refuse it with the reason.

    Unknown, revoked and expired are told apart on purpose: they call for
    different actions, and none of them says anything about the account.
    """
    try:
        row = await resolve_personal_access_token(session, raw_token=raw_token)
    except PersonalAccessTokenRefusal as refusal:
        await emit_event(
            session,
            action=event_actions.TOKEN_REFUSED,
            target_kind=event_actions.TARGET_TOKEN,
            actor_type=ActorType.anonymous,
            details={"reason": refusal.reason},
            trace_id=current_trace_id(),
        )
        await session.commit()
        raise _unauthorized(refusal.detail) from refusal

    user = await session.get(User, row.user_id)
    if user is None:
        raise _unauthorized("User not found.")
    if not user.is_active:
        raise _forbidden("User is disabled.")

    # The only usage record the token keeps, throttled so a busy script is not a
    # write per request (PT8). Nothing else is pending this early in the request.
    if should_touch_last_used(row):
        row.last_used_at = datetime.now(UTC)
        await session.commit()

    request.state.auth_credential = "personal_access_token"
    return user


async def require_session_auth(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    """Credential management needs a session (IA9 / PT4).

    A personal access token can do everything its owner can do *except* mint
    another one, revoke one, change the password, delete the account or
    provision a user — so a leaked token cannot entrench itself.
    """
    if getattr(request.state, "auth_credential", None) == "personal_access_token":
        raise _forbidden("This action requires a signed-in session, not a personal access token.")
    return user


async def require_superuser(user: User = Depends(get_current_user)) -> User:
    """Platform-level admin (gates starlette-admin)."""
    if not user.is_superuser:
        raise _forbidden("This action requires superuser privileges.")
    return user
