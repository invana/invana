"""FastAPI dependencies — user resolution and superuser gate.

Graph-scoped deps (membership, role gates) live in :mod:`invana.graphs.deps`.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.jwt import InvalidTokenError, decode_access_token
from invana.auth.models import User
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


async def require_superuser(user: User = Depends(get_current_user)) -> User:
    """Platform-level admin (gates starlette-admin)."""
    if not user.is_superuser:
        raise _forbidden("This action requires superuser privileges.")
    return user
