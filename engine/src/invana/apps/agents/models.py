"""SQLAlchemy model for ``agents`` (docs/for-developers/modules/ask/spec.md data model, extended by
docs/for-developers/modules/work/spec.md).

One row = one named actor in a graph. The columns split into four groups:

*identity* (``name`` · ``description`` · ``kind`` · ``status``) — what the trace
prints; *bindings* (``llm_config_id`` · ``skill_ids`` · ``workflow_spec``) — how
it thinks; *lineage* (``lifetime`` · ``parent_agent_id`` · ``spawned_in_run_id``)
— why it exists; and *bounds* (``budget`` · ``policy``) — what it may do.

Every JSON column is ``sqlalchemy.JSON`` (never JSONB) so SQLite dev keeps
working; ids are ``String(36)`` UUIDs like every other table.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base

# ``agents.llm_config_id`` FKs this table — see the note in ``work/models.py``.
from invana.apps.llm_providers.models import LLMProvider  # noqa: F401  isort: skip


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class AgentKind(enum.StrEnum):
    """Where the agent came from — the first thing the roster shows."""

    # Shipped with Invana and seeded per graph; not deletable.
    seeded = "seeded"
    # A user made it.
    authored = "authored"
    # An agent made it, under its parent's envelope (docs/for-developers/modules/work/spec.md).
    spawned = "spawned"


class AgentStatus(enum.StrEnum):
    active = "active"
    # No new runs open under it; running ones finish.
    paused = "paused"
    # Kept as a row so lineage and the trace still resolve to a name.
    retired = "retired"


class AgentLifetime(enum.StrEnum):
    persistent = "persistent"
    # Exists for the task it was spawned for; auto-retired when that closes,
    # hidden from the roster by default, fully present in lineage (D4).
    ephemeral = "ephemeral"


# Defaults live here rather than in the column so a missing key in an older row
# reads the same as an explicit one (``effective_budget`` merges over these).
DEFAULT_BUDGET: dict[str, int | float] = {
    "max_steps": 24,
    "max_replans": 1,
    "max_clarifications": 3,
    "max_children": 3,
    "max_depth": 2,
    "max_tokens": 200_000,
    "max_cost_usd": 5.0,
}

DEFAULT_POLICY: dict[str, bool] = {
    "can_spawn": False,
    "can_spawn_persistent": False,
    "can_rebind_llm": False,
    "can_be_assigned": True,
    "unattended": False,
}


class Agent(Base):
    """A named actor in a graph."""

    __tablename__ = "agents"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_agent_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── identity ─────────────────────────────────────────────────────────────
    # Stable machine handle for seeded agents ("explorer", "ql-query",
    # "modeller"); null for authored and spawned ones, which are found by name.
    key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default=AgentKind.authored.value, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=AgentStatus.active.value, nullable=False, index=True)

    # ── bindings ─────────────────────────────────────────────────────────────
    # The envelope (docs/for-developers/modules/agents/spec.md): allow-list · pinned args · require ·
    # budgets · which library workflows a Plan step may select. Not a table —
    # it is versioned with its agent.
    workflow_spec: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # SET NULL, not CASCADE: deleting a provider must not silently delete the
    # agents that used it — they go unbound and say so.
    llm_config_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("llm_providers.id", ondelete="SET NULL"), nullable=True
    )
    # Skill ids as a JSON array rather than a join table: the set is small, read
    # whole on every prompt assembly, and never queried from the skill side
    # except by ``GET …/skills/{id}/usage``, which scans the roster.
    skill_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # The agent's brief, layered on top of ``graph.instructions``. For a spawned
    # agent this is what its parent told it (docs/for-developers/modules/work/spec.md — the brief is all a
    # child receives; never the parent's step history).
    instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # ── lineage ──────────────────────────────────────────────────────────────
    lifetime: Mapped[str] = mapped_column(String(16), default=AgentLifetime.persistent.value, nullable=False)
    parent_agent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # The trace's answer to "why does this agent exist". No FK — a run may
    # be pruned (docs/for-developers/modules/ask/spec.md) while the agent it created stays.
    spawned_in_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # ── bounds ───────────────────────────────────────────────────────────────
    budget: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    policy: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Bumped on every envelope / binding change so a run can record which
    # version of the agent it ran under (``runs.agent_version``).
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    created_by_kind: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    created_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    # ── derived ──────────────────────────────────────────────────────────────

    @property
    def effective_budget(self) -> dict:
        return {**DEFAULT_BUDGET, **(self.budget or {})}

    @property
    def effective_policy(self) -> dict:
        return {**DEFAULT_POLICY, **(self.policy or {})}

    @property
    def is_available(self) -> bool:
        """Whether a new run may open under this agent."""
        return self.status == AgentStatus.active.value
