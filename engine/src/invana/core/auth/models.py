"""SQLAlchemy async models for Layer 1 — Identity & Access.

Identity (User + RefreshToken) lives here. Graph-scoped membership lives
in :mod:`invana.apps.graphs.models` alongside the Graph container and
GraphConnection per docs/for-developers/modules/identity-and-access/spec.md.

- ``users``           — authenticated principal. Carries ``username`` (URL
                        identity, globally unique) plus an optional ``email``
                        (login identity when present). ``is_superuser`` is the
                        platform-level flag (gates starlette-admin and DB-level ops).
- ``refresh_tokens``  — opaque, hashed refresh-token store.
- ``personal_access_tokens``
                      — long-lived, hashed credentials a person mints for a script
                        (docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).
                        Carries identity, never a scope (PT1).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    # Optional login identity. NULL-able so accounts can be provisioned without an
    # email (Postgres treats NULLs as distinct under the UNIQUE index). Login is
    # email-based, so an account without an email cannot sign in via Studio.
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)
    # URL identity. Lowercase + digits + hyphen, 2-64, no leading/trailing/consecutive hyphens.
    # All graph-scoped URLs live under /u/{username}/{graphSlug}, so usernames cannot collide
    # with Studio top-level routes (docs/for-developers/modules/identity-and-access/spec.md). Globally unique,
    # case-insensitive (stored lowercase).
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Free-form per-user UI preferences (client-owned bag). Currently holds the
    # theme selection under `theme` ({"theme", "mode", "accent"}); the studio
    # theme picker reads/writes it via PATCH /auth/me so the choice follows the
    # user across devices (docs/for-developers/modules/platform/features/theming.md). Kept as an open JSON bag so future
    # UI prefs
    # don't need a migration each.
    preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Platform-level superuser flag. Gates starlette-admin. Set ONLY by
    # `invana init` for the root user. Has no bearing on graph-level roles.
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Stamp set on every username change; enforces auth_username_change_cooldown_days.
    username_last_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(back_populates="user", cascade="all, delete-orphan")
    personal_access_tokens: Mapped[list[PersonalAccessToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    memberships: Mapped[list[GraphMember]] = relationship(  # noqa: F821 — forward ref resolved via SQLAlchemy registry
        back_populates="user",
        cascade="all, delete-orphan",
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class PersonalAccessToken(Base):
    """A long-lived credential carrying its owner's identity (PT1).

    Only the sha256 hash is stored (PT2) — the secret is returned once, at
    creation, and cannot be read back. ``last_four`` is display only, so a person
    can tell two rows apart in the list.
    """

    __tablename__ = "personal_access_tokens"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_pat_user_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # What the person called it. Unique per owner so a revoke confirms by name.
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    # Display tail — `invana_pat_…abcd`. Never enough to reconstruct the secret.
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    # NULL = never expires (PT7).
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Touched at most once a minute per token, so a busy script is not a write
    # per request (PT8).
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user: Mapped[User] = relationship(back_populates="personal_access_tokens")
