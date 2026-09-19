"""Opaque refresh-token + personal-access-token helpers.

Every flavour of token here is a random opaque string; only its sha256 hash is
persisted. Lookups compare hashes; raw tokens never round-trip the DB.

Personal access tokens carry the fixed ``invana_pat_`` prefix (PT3) so the
engine can route the credential without attempting a JWT decode, and a secret
scanner can recognise one in a repository
(docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.auth.models import PersonalAccessToken, RefreshToken
from invana.core.settings import settings


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


# ---------------------------------------------------------------------------
# Personal access tokens (PT1-PT8)
# ---------------------------------------------------------------------------

PAT_PREFIX = "invana_pat_"


def is_personal_access_token(raw: str) -> bool:
    """True when a bearer value is a personal access token rather than a JWT (PT3)."""
    return raw.startswith(PAT_PREFIX)


def generate_personal_access_token() -> str:
    """A new secret: the fixed prefix plus fresh entropy. Shown once, never stored raw."""
    return PAT_PREFIX + generate_token()


class PersonalAccessTokenRefusal(Exception):
    """A presented token resolved to no usable row. ``reason`` is what to tell the caller."""

    def __init__(self, reason: str, detail: str) -> None:
        super().__init__(detail)
        self.reason = reason
        self.detail = detail


async def resolve_personal_access_token(session: AsyncSession, *, raw_token: str) -> PersonalAccessToken:
    """Resolve a raw secret to its live row, or raise with the reason it was refused.

    The three refusals are told apart on purpose — an expired token and a revoked
    one call for different actions, and neither leaks anything about the account.
    """
    stmt = select(PersonalAccessToken).where(PersonalAccessToken.token_hash == hash_token(raw_token))
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise PersonalAccessTokenRefusal("unknown", "Unknown access token.")
    if row.revoked_at is not None:
        raise PersonalAccessTokenRefusal("revoked", "Token revoked.")
    if row.expires_at is not None and row.expires_at <= datetime.now(UTC):
        raise PersonalAccessTokenRefusal("expired", "Token expired.")
    return row


def should_touch_last_used(row: PersonalAccessToken, *, now: datetime | None = None) -> bool:
    """Throttle the usage stamp — at most one write per token per window (PT8)."""
    now = now or datetime.now(UTC)
    if row.last_used_at is None:
        return True
    last = row.last_used_at
    if last.tzinfo is None:  # SQLite hands back naive datetimes
        last = last.replace(tzinfo=UTC)
    return (now - last).total_seconds() >= settings.auth_token_last_used_throttle_seconds
