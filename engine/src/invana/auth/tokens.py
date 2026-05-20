"""Opaque refresh-token + invitation-token helpers.

Both flavours of token are random opaque strings; only their sha256 hashes
are persisted. Lookups compare hashes; raw tokens never round-trip the DB.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.models import RefreshToken
from invana.settings import settings


def generate_token() -> str:
    """Generate a random URL-safe token (used for both refresh + invitation tokens)."""
    return secrets.token_urlsafe(settings.auth_token_bytes)


def hash_token(token: str) -> str:
    """sha256-hex of the raw token. 64 chars."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def issue_refresh_token(session: AsyncSession, *, user_id: str) -> str:
    """Insert a new refresh token for the user and return the raw value (shown once)."""
    raw = generate_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.auth_refresh_token_ttl_days)
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_token(raw),
            expires_at=expires_at,
        )
    )
    return raw


async def find_active_refresh_token(session: AsyncSession, *, raw_token: str) -> RefreshToken | None:
    """Resolve a raw refresh token to its DB row if it's active (not revoked, not expired)."""
    stmt = select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if row.revoked_at is not None:
        return None
    if row.expires_at <= datetime.now(UTC):
        return None
    return row


async def revoke_refresh_token(session: AsyncSession, *, raw_token: str) -> None:
    """No-op if token not found or already revoked."""
    stmt = select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        return
    row.revoked_at = datetime.now(UTC)


async def revoke_all_refresh_tokens_for_user(session: AsyncSession, *, user_id: str) -> None:
    """Revoke every active refresh token for a user. Used by password change."""
    stmt = select(RefreshToken).where(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    )
    now = datetime.now(UTC)
    for row in (await session.execute(stmt)).scalars():
        row.revoked_at = now
