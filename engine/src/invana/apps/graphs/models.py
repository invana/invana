"""SQLAlchemy async models for the Graph domain (docs/for-developers/modules/identity-and-access/spec.md).

Tables
------
- ``graphs``             — Graph container (the unit of work). Carries identity,
                           membership, intent + setup state. CRUD lands in S2.
- ``graph_connections``  — 1:1 child of Graph; the DB binding (URL, driver, encrypted auth,
                           runtime health). Renamed from the previous ``graphs`` table.
- ``graph_members``      — (graph, user) access join. Composite PK. Binary membership
                           (a row == full access); roles removed in
                           docs/for-developers/modules/identity-and-access/features/membership.md.
"""

from __future__ import annotations

import enum
import json
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

from invana.apps.modeller.models import GraphModel
from invana.core.auth.models import User
from invana.core.models import Base

# What a Graph's pools hold when nobody has tuned them — sized for one machine
# (docs/for-developers/modules/agents/features/concurrency-and-contention.md).
DEFAULT_POOLS: dict[str, int] = {"llm": 20, "graphdb": 50, "heavy": 4}
# The same value as a literal, so a row inserted outside the ORM gets it too.
_DEFAULT_POOLS_JSON = json.dumps(DEFAULT_POOLS)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class GraphStatus(enum.StrEnum):
    active = "active"
    archived = "archived"


# Shared Enum types — ``create_type=False`` everywhere; the migration creates the
# PG type exactly once.
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
    instructions, setup state, and the analytical bindings that hang off
    it (members, datasets, skills, agents…).
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
    # Standing guidance the Graph's agents follow (ChatGPT-/Claude-project-style
    # custom instructions). An optional setup step, written once there is a model
    # and a provider for it to instruct (setup.md SU5).
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Skips, per section. Everything else about setup is derived at serialize
    # time (docs/for-developers/modules/platform/features/setup.md SU1).
    # Shape: {graph_info: {completed_at?, skipped_at?}, instructions: {...}, skills: {...}, datasets: {...}}.
    setup_state: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[GraphStatus] = mapped_column(_graph_status_enum, nullable=False, default=GraphStatus.active)
    # The agent a new session starts with (docs/for-developers/modules/agents/spec.md). No FK: agents cascade
    # from the graph, so a real FK here would be a cycle at delete time.
    default_agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # How many runs may run at once in this Graph, and what happens at the
    # ceiling (docs/for-developers/modules/agents/features/concurrency-and-contention.md).
    #
    # A budget bounds one agent's spend; nothing bounded the Graph. Ten agents,
    # each inside its own ceiling, are still ten concurrent query loads, ten
    # claims on a provider's rate limit, and ten connections from a pool that has
    # fewer. The default suits one machine (CC1).
    max_concurrent_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=4, server_default="4")
    # ``queue`` waits for a slot; ``refuse`` says so immediately. Stated on the
    # Graph rather than guessed per caller (CC2).
    concurrency_policy: Mapped[str] = mapped_column(String(8), nullable=False, default="queue", server_default="queue")
    # The pools a run draws on while it holds its slot
    # (docs/for-developers/modules/agents/features/concurrency-and-contention.md CC8).
    # Three, because they are three different scarce things and one number would
    # have to be the smallest of them: `llm` is provider concurrency (a lane takes
    # a slot, not a step), `graphdb` is the connection pool, `heavy` is graph
    # algorithms, which are CPU- and memory-bound. A refusal names the pool.
    pools: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=lambda: dict(DEFAULT_POOLS), server_default=_DEFAULT_POOLS_JSON
    )
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

    Owns one ``GraphModel`` (1:1 via unique FK on ``model_id``).
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
    # Which database on the server this Graph reads (connect-a-database.md CD8).
    # Not a secret, so it lives here rather than inside ``auth_encrypted`` and is
    # returned by the API. NULL/blank means "the connector's own default".
    database: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)

    # Runtime status — managed by GraphConnectionManager
    status: Mapped[str] = mapped_column(
        Enum("CONNECTING", "ACTIVE", "ERROR", "INACTIVE", name="graph_connection_status_enum"),
        default="CONNECTING",
    )
    last_health_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Backend version compatibility (docs/for-developers/modules/graph-connectors/features/capabilities.md). Populated
    # at connect/health-check.
    # server_version: detected (or user-declared) DB version, e.g. "5.20.0".
    # server_version_source: "detected" | "declared".
    # compatibility_status: cached CompatibilityStatus (supported/untested/unsupported/unknown).
    # version_acknowledged: user accepted the risk of an UNTESTED version (lifts read-only).
    server_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    server_version_source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    compatibility_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    version_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 1:1 link to owned schema — UNIQUE enforces the constraint at DB level
    model_id: Mapped[str | None] = mapped_column(
        ForeignKey("graph_models.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    graph: Mapped[Graph | None] = relationship(back_populates="connection")
    schema: Mapped[GraphModel | None] = relationship(
        "GraphModel",
        foreign_keys=[model_id],
        lazy="select",
    )


# ---------------------------------------------------------------------------
# GraphMember
# ---------------------------------------------------------------------------


class GraphMember(Base):
    """User↔graph access join. Binary membership (a row == full access).

    Roles were removed in docs/for-developers/modules/identity-and-access/features/membership.md; this table no longer
    carries a ``role``
    column. ``get_graph_membership`` / ``require_graph_member`` gate every
    graph-scoped route on the mere existence of a row.
    """

    __tablename__ = "graph_members"

    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    # The one field-level permission in the product
    # (docs/for-developers/modules/govern/features/guardrails.md GR5 · GV22).
    # Not a role: a Member stays binary, and this does not start a role system.
    # The guardrails are *readable* by every member whatever this says — a bound
    # nobody may read is a bound nobody can work within — and a Graph always has
    # at least one holder, so revoking the last one is refused.
    can_edit_guardrails: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    graph: Mapped[Graph] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")
