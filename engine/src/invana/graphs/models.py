"""SQLAlchemy async models for the Graph domain (RFC-017).

Tables
------
- ``graphs``             — Graph container (the unit of work). Carries identity,
                           membership, intent + setup state. CRUD lands in S2.
- ``graph_connections``  — 1:1 child of Graph; the DB binding (URL, driver, encrypted auth,
                           runtime health). Renamed from the previous ``graphs`` table.
- ``graph_members``      — (graph, user) -> role. Composite PK.
- ``invitations``        — graph-scoped registration token. One-shot, hashed.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.auth.models import User
from invana.modeller.models import Base, GraphSchema


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class GraphRole(enum.StrEnum):
    """Per-graph role. See docs/internal/mvp/layer-1-identity-access.md."""

    developer = "developer"
    analyst = "analyst"
    admin = "admin"


class GraphStatus(enum.StrEnum):
    active = "active"
    archived = "archived"


# Shared Enum types — ``create_type=False`` everywhere; the migration creates the
# PG type exactly once.
_graph_role_enum = Enum(
    GraphRole,
    name="graph_role",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)

_graph_status_enum = Enum(
    GraphStatus,
    name="graph_status",
    values_callable=lambda x: [m.value for m in x],
    create_type=False,
)


# ---------------------------------------------------------------------------
# Graph container
# ---------------------------------------------------------------------------


class Graph(Base):
    """The unit of work — a knowledge graph and everything that lives in it.

    1:1 with ``GraphConnection``. Carries identity (slug + owner),
    intent + objectives, setup-wizard state, and the analytical bindings
    that hang off it (members, invitations, datasets, skills, agents…).
    """

    __tablename__ = "graphs"
    __table_args__ = (
        # Slug is unique per owner — URLs are /u/{owner_username}/{slug}.
        UniqueConstraint("created_by_id", "slug", name="uq_graphs_owner_slug"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Captured at creation — short statement of what the Graph is for.
    intent: Mapped[str | None] = mapped_column(Text, nullable=True)
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Per-section completion + skipped state for the setup wizard.
    # Shape: {graph_info: {completed_at?, skipped_at?}, intent: {...}, skills: {...}, datasets: {...}}.
    setup_state: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[GraphStatus] = mapped_column(_graph_status_enum, nullable=False, default=GraphStatus.active)
    # RESTRICT — owner cannot be deleted while they still own a Graph.
    # Account deletion checks for this and 409s on guard B.
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    connection: Mapped[GraphConnection | None] = relationship(
        back_populates="graph",
        uselist=False,
        cascade="all, delete-orphan",
    )
    members: Mapped[list[GraphMember]] = relationship(back_populates="graph", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# GraphConnection — 1:1 child of Graph (renamed from the previous `Graph` model)
# ---------------------------------------------------------------------------


class GraphConnection(Base):
    """Persisted graph-DB connection record. 1:1 with ``Graph``.

    Owns one ``GraphSchema`` (1:1 via unique FK on ``schema_id``).
    Live connector instances are managed separately by ``GraphConnectionManager``.
    """

    __tablename__ = "graph_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    # 1:1 link to the parent Graph. UNIQUE enforces the 1:1 at the DB level.
    # Nullable column is a historical artefact from the deleted standalone
    # /api/v1/graph-connections/* surface; tightening to NOT NULL is a future
    # migration once any orphan rows are cleared.
    graph_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=True,
        unique=True,
        index=True,
    )

    # Connection details — name/description previously lived here but were
    # redundant with the parent Graph's name/description (the connection is
    # 1:1 with the Graph). Removed in migration 00000000000e.
    uri: Mapped[str] = mapped_column(String(2048), nullable=False)
    connector_class: Mapped[str] = mapped_column(String(512), nullable=False)
    auth_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)

    # Runtime status — managed by GraphConnectionManager
    status: Mapped[str] = mapped_column(
        Enum("CONNECTING", "ACTIVE", "ERROR", "INACTIVE", name="graph_connection_status_enum"),
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

    graph: Mapped[Graph | None] = relationship(back_populates="connection")
    schema: Mapped[GraphSchema | None] = relationship(
        "GraphSchema",
        foreign_keys=[schema_id],
        lazy="select",
    )


# ---------------------------------------------------------------------------
# GraphMember
# ---------------------------------------------------------------------------


class GraphMember(Base):
    __tablename__ = "graph_members"

    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[GraphRole] = mapped_column(_graph_role_enum, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    graph: Mapped[Graph] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


# ---------------------------------------------------------------------------
# Invitation — graph-scoped
# ---------------------------------------------------------------------------


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[GraphRole] = mapped_column(_graph_role_enum, nullable=False)
    invited_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
