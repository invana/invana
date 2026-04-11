"""SQLAlchemy async model for graph database connections.

Tables
------
- ``graphs`` — persisted graph database connection records, each owning one GraphSchema (1:1).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.modeller.models import Base, GraphSchema


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class Graph(Base):
    """Persisted graph database connection record.

    Owns one ``GraphSchema`` (1:1 via unique FK on ``schema_id``).
    Live connector instances are managed separately by ``GraphConnectionManager``.
    """

    __tablename__ = "graphs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")

    # Connection details
    uri: Mapped[str] = mapped_column(String(2048), nullable=False)
    connector_class: Mapped[str] = mapped_column(String(512), nullable=False)
    auth_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)

    # Runtime status — managed by GraphConnectionManager
    status: Mapped[str] = mapped_column(
        Enum("CONNECTING", "ACTIVE", "ERROR", "INACTIVE", name="graph_status_enum"),
        default="CONNECTING",
    )
    last_health_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 1:1 link to owned schema — UNIQUE enforces the constraint at DB level
    schema_id: Mapped[str | None] = mapped_column(
        ForeignKey("graph_schemas.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    schema: Mapped[GraphSchema | None] = relationship(
        "GraphSchema",
        foreign_keys=[schema_id],
        lazy="select",
    )
