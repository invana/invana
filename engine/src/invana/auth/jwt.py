"""Access-token JWT encode/decode.

Refresh tokens are NOT JWTs — they are opaque server-side strings stored
hashed in the ``refresh_tokens`` table (see ``tokens.py``).

The JWT carries the user identity ONLY. Role is workspace-scoped and
resolved on a per-request basis via WorkspaceMember lookup.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from invana.settings import settings


class InvalidTokenError(Exception):
    """Raised when an access token is missing, malformed, expired, or has the wrong type."""


def _secret() -> str:
    if not settings.secret_key:
        raise RuntimeError("INVANA_SECRET_KEY is not set. Refusing to sign or verify tokens.")
    return settings.secret_key


def encode_access_token(*, user_id: str, is_superuser: bool) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": user_id,
        "sup": bool(is_superuser),
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.auth_access_token_ttl_minutes)).timestamp()),
    }
    return jwt.encode(payload, _secret(), algorithm=settings.auth_jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[settings.auth_jwt_algorithm])
    except jwt.PyJWTError as e:
        raise InvalidTokenError(str(e)) from e
    if payload.get("type") != "access":
        raise InvalidTokenError("Token is not an access token.")
    return payload
