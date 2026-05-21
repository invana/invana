"""SQLAlchemy async models for Layer 1 — Identity & Access.

Identity (User + RefreshToken) lives here. Graph-scoped membership and
invitations live in :mod:`invana.graphs.models` alongside the Graph
container and GraphConnection per RFC-017.

- ``users``           — authenticated principal. Carries ``username`` (URL
                        identity, globally unique) plus ``email`` (login
                        identity). ``is_superuser`` is the platform-level
                        flag (gates starlette-admin and DB-level ops).
- ``refresh_tokens``  — opaque, hashed refresh-token store.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    # URL identity. Lowercase + digits + hyphen, 2-64, no leading/trailing/consecutive hyphens.
    # All graph-scoped URLs live under /u/{username}/{graphSlug}, so usernames cannot collide
    # with Studio top-level routes (RFC-017). Globally unique, case-insensitive (stored lowercase).
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
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
