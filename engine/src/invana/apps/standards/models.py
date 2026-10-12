"""The standard record — install-wide, versioned terms a dataset is scored against.

A **standard** is a shared vocabulary addressed ``publisher/name``
(docs/for-developers/modules/bring-data-in/features/standards.md). Its
**versions** are immutable and hashed; each holds its **terms** — a name, a
type, whether it is required, and the values it allows. Everyone in the install
reads every standard: a private one would be a constraint.

=====================  ====================================================
table                  holds
=====================  ====================================================
``standards``          the address, origin and the current version
``standard_versions``  the terms and their hash — immutable
=====================  ====================================================

``Enforcement`` lives here because it is the one word a standard's attachment
and a checked rule share: ``block · warn · report``.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class StandardOrigin(enum.StrEnum):
    #: Shipped with Invana and applied by an install Admin.
    pack = "pack"
    #: Written by a lab or an organisation in this install.
    authored = "authored"


class TermType(enum.StrEnum):
    text = "text"
    integer = "integer"
    number = "number"
    boolean = "boolean"
    #: ISO ``YYYY-MM-DD``.
    date = "date"


class Enforcement(enum.StrEnum):
    """What a broken bound does to the act that broke it."""

    #: The act is refused and nothing is written.
    block = "block"
    #: The act goes through and its response says so.
    warn = "warn"
    #: The act goes through; the breach is recorded only.
    report = "report"


class Standard(Base):
    """One standard, addressed ``publisher/name``. Its content is its versions."""

    __tablename__ = "standards"
    __table_args__ = (UniqueConstraint("publisher", "name", name="uq_standard_address"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    publisher: Mapped[str] = mapped_column(String(63), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(63), nullable=False)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    #: ``pack`` or ``authored``; set at create, never changed.
    origin: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    current_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("standard_versions.id", ondelete="SET NULL", use_alter=True, name="fk_standards_current_version"),
        nullable=True,
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    @property
    def address(self) -> str:
        return f"{self.publisher}/{self.name}"


class StandardVersion(Base):
    """One published set of terms. **Immutable** once written."""

    __tablename__ = "standard_versions"
    __table_args__ = (UniqueConstraint("standard_id", "version", name="uq_standard_version_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    standard_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("standards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    #: ``[{name, type, required, values?, description?}]`` in authored order.
    terms: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: ``sha256:<hex>`` over the terms in order.
    content_hash: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    why: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
