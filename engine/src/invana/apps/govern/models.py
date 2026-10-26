"""SQLAlchemy models for Govern — the lens, the ledger's projection, and requests.

``lenses`` is **one table for two things**
([GV1](docs/for-developers/modules/govern/spec.md)): a *world* people pick per
question and a *guardrail* always in force, separated by ``kind``. A Graph's
guardrail is one property rule — ``target`` · ``access`` · ``leaves`` — whose
``rules`` are compiled from it at save, so enforcement, the frozen snapshot and
the touch record keep one path. An agent's own guardrail stays a layered lens.

``run_touches`` is the indexed projection of ``task_stream``
([GV20](docs/for-developers/modules/govern/spec.md)) — every row derives from
exactly one stream row and carries its ``seq``. The stream stays authoritative:
if the two disagree the ledger wins, and the table is rebuildable from it.

``requests`` is the inbox of what people and agents asked to be modelled or
allowed — filed by the engine where an ask fails, resolved by a modeller.

Every JSON column is ``sqlalchemy.JSON`` (never JSONB) so SQLite dev keeps
working; ids are ``String(36)`` UUIDs like every other table.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class LensKind(enum.StrEnum):
    """The only thing that tells a world from a guardrail."""

    #: Named, listed, picked per question, narrows within the guardrails.
    world = "world"
    #: Always in force, never in the Worlds list, its own permission to edit.
    guardrail = "guardrail"


class GuardrailAccess(enum.StrEnum):
    """What a run may do with a guarded property."""

    #: Read it — the rule then exists only to keep the result in the Graph.
    read = "read"
    #: Filter, count and aggregate it; never return its value.
    counts = "counts"
    #: It does not exist in any run.
    never = "never"


#: A Graph guardrail's scope — the one the Guardrails page lists.
GRAPH_SCOPE = "graph"


class TouchDirection(enum.StrEnum):
    """What happened at a participant."""

    #: Something left for it — a query, a prompt, a call.
    out = "out"
    #: Something came back.
    into = "in"
    #: The lens said no. Recorded in ``seq`` order and struck in place, never
    #: filtered out — a refusal is part of what the run did.
    refused = "refused"
    #: Permitted, and the run did not need it.
    skipped = "skipped"


class Lens(Base):
    """A narrowing: what a run may see, use and send."""

    __tablename__ = "lenses"
    __table_args__ = (
        # Plain, not partial: SQL NULLs are distinct, so any number of unnamed
        # lenses coexist while two named the same thing collide.
        UniqueConstraint("graph_id", "key", name="uq_lens_graph_key"),
        CheckConstraint(
            "(kind = 'guardrail' AND scope IS NOT NULL AND key IS NOT NULL) OR (kind = 'world' AND scope IS NULL)",
            name="ck_lens_kind_shape",
        ),
        CheckConstraint(
            "kind <> 'guardrail' OR scope <> 'graph' "
            "OR (target IS NOT NULL AND access IS NOT NULL AND leaves IS NOT NULL)",
            name="ck_lens_graph_guardrail_rule",
        ),
        Index("ix_lens_graph_kind", "graph_id", "kind"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    kind: Mapped[str] = mapped_column(String(16), default=LensKind.world.value, nullable=False)

    # ── naming, which is what publishes ──────────────────────────────────────
    #: The slug; NULL while unnamed and private. Frozen at the first naming.
    key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    #: What a person typed, or a guardrail's generated name. NULL exactly when ``key`` is.
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    #: Guardrail only: ``graph`` or ``agent:<id>``.
    scope: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── a Graph guardrail's one property rule ────────────────────────────────
    #: ``Type.property``, ``*`` allowed on either side.
    target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: ``read`` · ``counts`` · ``never``.
    access: Mapped[str | None] = mapped_column(String(8), nullable=True)
    #: Whether a result built on it may cross to a model or a third party.
    leaves: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    #: World ids a request allowed this guardrail in; runs asked there do not carry it.
    allowed_in: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # ── what it says ─────────────────────────────────────────────────────────
    #: Authored on a world or an agent's guardrail; compiled from the rule on a Graph's.
    rules: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: ``{role: address}`` — a resolution, checked once innermost has won.
    cast: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: Layers this lens allow-lists; one absent is permitted whole.
    closed_layers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: Transaction time — which versions and stitches are in view. NULL is now.
    as_of: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── where it came from ───────────────────────────────────────────────────
    #: The run an unnamed lens belongs to. No FK: a run may be pruned first.
    created_in_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Bumped on every edit, so a snapshot names what it froze.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    @property
    def is_named(self) -> bool:
        """Named ⟹ shared. There is no ownership column and no share action."""
        return self.key is not None

    @property
    def display_name(self) -> str:
        """What every surface prints, including for a lens nobody has named.

        *Nothing set* and *nothing permitted* must never look alike
        ([GR6](docs/for-developers/modules/govern/features/guardrails.md)), and
        an unnamed lens is a real narrowing that simply has no name yet.
        """
        return self.name or "this run only"

    @property
    def agent_scope_id(self) -> str | None:
        """The agent an ``agent:<id>`` guardrail is pinned to, if it is one."""
        if self.scope and self.scope.startswith("agent:"):
            return self.scope.split(":", 1)[1]
        return None

    @property
    def is_graph_guardrail(self) -> bool:
        """A Graph's guardrail — one property rule, listed on the Guardrails page."""
        return self.kind == LensKind.guardrail.value and self.scope == GRAPH_SCOPE


def _with_tokens(volume: dict[str, Any]) -> dict[str, Any]:
    """The volume, with ``tokens`` beside its in and out when it spent any."""
    if "tokens_in" not in volume and "tokens_out" not in volume:
        return volume
    return {**volume, "tokens": (volume.get("tokens_in") or 0) + (volume.get("tokens_out") or 0)}


class RunTouch(Base):
    """One recorded engagement with one participant.

    Declared is half of it: the lens says what *may* participate, and these say
    what *did* — refusals included. The difference between the two is what a
    person reads when they retune.
    """

    __tablename__ = "run_touches"
    __table_args__ = (
        UniqueConstraint("run_id", "seq", name="uq_run_touch_seq"),
        # *Which runs touched this address* — the question `Compare` and
        # "which worlds name this model" are both asking.
        Index("ix_run_touch_graph_address", "graph_id", "address"),
        Index("ix_run_touch_run_direction", "run_id", "direction"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Denormalised from the run, so a cross-run read is one index hit.
    graph_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    #: The ``task_stream.seq`` this row projects. The ledger stays authoritative.
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    step_key: Mapped[str | None] = mapped_column(String(64), nullable=True)

    address: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    layer: Mapped[str] = mapped_column(String(16), nullable=False)
    sublayer: Mapped[str] = mapped_column(String(64), nullable=False)
    #: The last part of the address, so a list renders without re-parsing.
    participant: Mapped[str] = mapped_column(String(255), nullable=False)

    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    #: The pattern that decided it, so a refusal names its rule.
    rule_matched: Mapped[str | None] = mapped_column(String(512), nullable=True)
    #: One readable sentence, on a refusal.
    why: Mapped[str | None] = mapped_column(String(255), nullable=True)

    #: ``{rows, tokens_in, tokens_out, bytes, cache_hit, age_s}`` — ``rows`` is the only count.
    volume: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: The narrowing that bit — ``models``, ``select`` and the property keys per type.
    applied: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{to, classes, cut}`` — what crossed, and what was cut from it.
    sent: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{generated_sha256, executed_sha256}`` — both, so a rewrite is visible.
    query: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    @property
    def was_refused(self) -> bool:
        return self.direction == TouchDirection.refused.value

    def as_reading(self) -> dict[str, Any]:
        """The shape the run board and `Compare` both read."""
        return {
            "seq": self.seq,
            "step_key": self.step_key,
            "address": self.address,
            "layer": self.layer,
            "sublayer": self.sublayer,
            "participant": self.participant,
            "direction": self.direction,
            "rule_matched": self.rule_matched,
            "why": self.why,
            "volume": _with_tokens(self.volume or {}),
            "applied": self.applied or {},
            "sent": self.sent or {},
            "query": self.query or {},
            "cost_usd": self.cost_usd,
            "duration_ms": self.duration_ms,
        }


class RequestKind(enum.StrEnum):
    """Where a request came from."""

    #: A guardrail refused the read, and the guardrail is its blocker.
    guardrail = "guardrail"
    #: The run ended *cannot answer · outside this graph*.
    unanswered = "unanswered"
    #: Asked for explicitly — Explorer's *Ask for a change*, the CLI, the API.
    change = "change"


class RequestSource(enum.StrEnum):
    explorer = "explorer"
    agent = "agent"
    schedule = "schedule"
    api = "api"


class RequestStatus(enum.StrEnum):
    open = "open"
    done = "done"


class RequestResolution(enum.StrEnum):
    declined = "declined"
    allowed = "allowed"
    modelled = "modelled"


class Request(Base):
    """One ask the Graph could not serve, waiting on a modeller.

    Repeated asks of the same open request add to ``asks`` rather than filing a
    second row, so the inbox is one line per gap.
    """

    __tablename__ = "requests"
    __table_args__ = (
        Index("ix_requests_graph_status", "graph_id", "status"),
        Index("ix_requests_guardrail", "guardrail_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: ``guardrail`` · ``unanswered`` · ``change``.
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    #: The ask as asked.
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    #: What the run said.
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: ``explorer`` · ``agent`` · ``schedule`` · ``api``.
    source: Mapped[str] = mapped_column(String(16), nullable=False, default=RequestSource.api.value)

    asked_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: The agent that asked, when no person did. No FK: an agent may be deleted.
    agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    #: The run that failed. No FK: runs are pruned.
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    guardrail_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("lenses.id", ondelete="SET NULL"), nullable=True
    )
    #: The guardrail's name frozen at filing, so a deleted one still reads.
    blocked_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    asks: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_asked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    #: ``open`` · ``done``.
    status: Mapped[str] = mapped_column(String(8), default=RequestStatus.open.value, nullable=False)
    #: ``declined`` · ``allowed`` · ``modelled``, once done.
    resolution: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: What resolving did, as the done row reads it.
    resolution_note: Mapped[str | None] = mapped_column(String(512), nullable=True)
    world_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("lenses.id", ondelete="SET NULL"), nullable=True
    )
    model_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("graph_models.id", ondelete="SET NULL"), nullable=True
    )
    resolved_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    @property
    def is_open(self) -> bool:
        return self.status == RequestStatus.open.value
