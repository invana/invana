"""SQLAlchemy model for ``agents`` (docs/for-developers/modules/ask/spec.md data model, extended by
docs/for-developers/modules/work/spec.md).

One row = one named actor in a graph. The columns split into four groups:

*identity* (``name`` · ``description`` · ``kind`` · ``status``) — what the trace
prints; *bindings* (``skill_ids`` · ``workflow_spec``) — how it thinks;
*lineage* (``lifetime`` · ``parent_agent_id`` · ``spawned_in_run_id``) — why it
exists; *standing limits* (``workflow_spec`` · ``effort`` · ``budget``) — what it
may do, how hard it tries and what it may spend, whoever asks; and *voice*
(``soul`` · ``soul_traits``) — how it speaks, and nothing else
(docs/for-developers/modules/agents/features/soul.md SO2).

There is no world column: what a run may see comes with the work that opens it,
and an agent's own narrowing is a guardrail scoped ``agent:<id>``
(docs/for-developers/modules/agents/features/author-an-agent.md AG24 · AG26).

Every JSON column is ``sqlalchemy.JSON`` (never JSONB) so SQLite dev keeps
working; ids are ``String(36)`` UUIDs like every other table.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class AgentKind(enum.StrEnum):
    """Where the agent came from — the first thing the list shows."""

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
    # hidden from the list by default, fully present in lineage (D4).
    ephemeral = "ephemeral"


# Defaults live here rather than in the column so a missing key in an older row
# reads the same as an explicit one (``effective_budget`` merges over these).
DEFAULT_BUDGET: dict[str, int | float] = {
    # No steps, replans or clarifications: those are effort, not money
    # (``DEFAULT_EFFORT`` · EB9).
    "max_children": 3,
    "max_depth": 2,
    "max_tokens": 200_000,
    # Spend, in two windows. A per-run ceiling and a per-month one side by side
    # is why the month one is named
    # ([EB1](docs/for-developers/modules/agents/features/envelope-and-budget.md)) —
    # `max_cost_usd` never said which window it bounded.
    "max_cost_usd_month": 5.0,
    "max_cost_usd_run": 2.0,
    # Lanes a `map_over` may open, refused **at validation** rather than mid-run
    # (EB2). Nothing dispatches a fanned-out node yet, so nothing reads this
    # today; it is declared because a ceiling the record does not carry is one
    # the screen cannot draw.
    "max_fanout": 200,
    # Across every run this agent is working. The **Graph's** ceiling is a
    # different bound with a different policy
    # ([CC1](docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
    "max_concurrent_runs": 3,
}

#: The name ``max_cost_usd_month`` had before it said which window it bounded.
#: Read for one release, so a row configured today keeps its ceiling across the
#: rename (data-model § 8 #4).
_LEGACY_MONTH_KEY = "max_cost_usd"

#: How hard an agent tries before it stops
#: ([EB9](docs/for-developers/modules/agents/features/envelope-and-budget.md)).
#: Not money, so not ``budget``; it decides what runs, so not the soul.
DEFAULT_EFFORT: dict[str, int] = {
    "max_steps": 24,
    "max_replans": 1,
    "max_clarifications": 3,
}

DEFAULT_POLICY: dict[str, bool] = {
    "can_spawn": False,
    "can_spawn_persistent": False,
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
    # There is no `llm_config_id`: an agent binds no provider
    # ([PM1](docs/for-developers/modules/agents/features/providers-and-models.md)).
    # A plan names a role, the run's frozen cast maps the role to an address,
    # and the address names the configured row whose credential it is.
    # The agent's brief, layered on top of ``graph.instructions``. For a spawned
    # agent this is what its parent told it (docs/for-developers/modules/work/spec.md — the brief is all a
    # child receives; never the parent's step history).
    instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # ── voice ────────────────────────────────────────────────────────────────
    # Who the agent is, as Markdown. Empty is Invana's default voice (SO3). It
    # reaches only the steps whose words a person reads — never a query, a plan
    # or a lens (SO2).
    soul: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # The voice dials — the soul in structured form, read before the Markdown
    # (AG16). A missing key is its default; ``invana.apps.llm.voice`` owns the
    # vocabulary and refuses anything outside it.
    soul_traits: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

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
    # ``max_steps`` · ``max_replans`` · ``max_clarifications`` (EB9). Read
    # through ``effective_effort``, which falls back to ``workflow_spec`` and
    # then ``budget`` for one release — where these numbers lived before.
    effort: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
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

    #: The skills this agent is offered, through ``skill_bindings``
    #: ([BN6](docs/for-developers/modules/skills/features/bindings.md)).
    #: **Read-only**: binding is a write with its own refusal and its own event,
    #: so ``SkillBindingManager`` owns it and nothing sets this.
    # Un-annotated on purpose: ``Mapped[list]`` without a parameter reads as a
    # scalar to declarative, and the attribute comes back ``None`` instead of an
    # empty collection. The target is named by string, so this package still
    # imports nothing from ``apps/skills``.
    bound_skills = relationship(
        "Skill",
        secondary="skill_bindings",
        lazy="selectin",
        viewonly=True,
    )

    # ── derived ──────────────────────────────────────────────────────────────

    @property
    def skill_ids(self) -> list[str]:
        """What prompt assembly, delegation and the skills badge read.

        Kept as a name so the readers did not all have to learn that the
        binding moved; what changed is that nothing can assign to it.
        """
        return sorted(s.id for s in (self.bound_skills or []))

    @property
    def effective_budget(self) -> dict:
        """The ceilings this agent runs inside, defaults filled in.

        **Both names for the month ceiling are read, for one release.** A row
        written before the rename carries `max_cost_usd`, and it means the
        month — so it wins where the new name is absent, and the old name is
        answered back so a reader that has not moved yet still sees a number
        rather than nothing. Neither half of that is permanent: the release
        after this one drops both lines (data-model § 8 #4).
        """
        own = self.budget or {}
        budget = {**DEFAULT_BUDGET, **own}
        if _LEGACY_MONTH_KEY in own and "max_cost_usd_month" not in own:
            budget["max_cost_usd_month"] = own[_LEGACY_MONTH_KEY]
        budget.setdefault(_LEGACY_MONTH_KEY, budget["max_cost_usd_month"])
        return budget

    @property
    def effective_effort(self) -> dict[str, int]:
        """Steps, replans and clarifications, defaults filled in.

        ``effort`` is the source. **``workflow_spec`` and then ``budget`` are
        read where it is silent, for one release** — a row written before the
        column existed carries its numbers there, and the migration's backfill
        does not reach an agent spawned from an older parent mid-release. The
        release after this one drops both fallbacks (EB9).

        Presence, never truthiness: ``max_clarifications: 0`` is an agent that
        never asks, not one that asks the default three times.
        """
        own, spec, budget = self.effort or {}, self.workflow_spec or {}, self.budget or {}
        out: dict[str, int] = {}
        for key, default in DEFAULT_EFFORT.items():
            for source in (own, spec, budget):
                if source.get(key) is not None:
                    out[key] = int(source[key])
                    break
            else:
                out[key] = default
        return out

    @property
    def effective_policy(self) -> dict:
        return {**DEFAULT_POLICY, **(self.policy or {})}

    @property
    def is_available(self) -> bool:
        """Whether a new run may open under this agent."""
        return self.status == AgentStatus.active.value
