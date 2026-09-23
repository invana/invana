"""SQLAlchemy models for Govern — the one record, and the projection of the ledger.

``lenses`` is **one table for two things**
([GV1](docs/for-developers/modules/govern/spec.md)): a *world* people pick per
question and a *guardrail* always in force, separated by ``kind`` and nothing
else. One enforcement path, one document frozen onto a run, and promotion is a
field change rather than a re-authoring.

``run_touches`` is the indexed projection of ``task_stream``
([GV20](docs/for-developers/modules/govern/spec.md)) — every row derives from
exactly one stream row and carries its ``seq``. The stream stays authoritative:
if the two disagree the ledger wins, and the table is rebuildable from it.

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
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
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
        # lenses coexist while two named the same thing collide — which is the
        # refusal `worlds.md` promises on `key`.
        UniqueConstraint("graph_id", "key", name="uq_lens_graph_key"),
        CheckConstraint(
            "(kind = 'guardrail' AND scope IS NOT NULL AND key IS NOT NULL) OR (kind = 'world' AND scope IS NULL)",
            name="ck_lens_kind_shape",
        ),
        Index("ix_lens_graph_kind", "graph_id", "kind"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    kind: Mapped[str] = mapped_column(String(16), default=LensKind.world.value, nullable=False)

    # ── naming, which is what publishes ──────────────────────────────────────
    #: The slug. NULL = unnamed, attached to its run, private to whoever ran it.
    #: Setting it is the write that puts the lens in the Graph's Worlds list
    #: ([WO1](docs/for-developers/modules/govern/features/worlds.md)); it is
    #: derived from ``name`` at the first naming and then frozen, because a slug
    #: that moved on rename would break every schedule that pinned one
    #: ([GV19](docs/for-developers/modules/govern/spec.md)).
    key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    #: What a person typed — ``EU · H1 2026``. NULL exactly when ``key`` is.
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    #: Guardrail only: ``graph`` or ``agent:<id>``. Where it is pinned.
    scope: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── what it says ─────────────────────────────────────────────────────────
    rules: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: ``{role: address}``. Not a bound — a resolution, checked against the
    #: effective rules once innermost has won
    #: ([GV6](docs/for-developers/modules/govern/spec.md)).
    cast: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: The layers this lens allow-lists. A layer named here admits only what its
    #: rules allow; one absent from it is permitted whole
    #: ([GV23](docs/for-developers/modules/govern/spec.md)).
    closed_layers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: Transaction time — which model versions and stitches are in view. NULL
    #: means now. Composes with ``select.time``, which is *valid* time
    #: ([GV15](docs/for-developers/modules/govern/spec.md)).
    as_of: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── where it came from ───────────────────────────────────────────────────
    #: The run an unnamed lens belongs to. No FK: a run may be pruned while the
    #: lens it created stays, and a lens with a dangling run id is still a lens.
    created_in_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Bumped on every ``rules``/``cast`` edit, so a snapshot names what it froze.
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
    #: Denormalised from the run so a cross-run query over an address is one
    #: index hit rather than a join back through ``task_runs``.
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

    #: ``{rows, tokens_in, tokens_out, bytes, cache_hit, age_s}``. ``rows`` is
    #: the only count, and there is no second one: what the query would have
    #: returned unsliced is knowable only by running it unsliced
    #: ([WO19](docs/for-developers/modules/govern/features/worlds.md)).
    volume: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{models, select, properties_excluded, projected, composed}`` — the
    #: narrowing that bit. ``select`` and ``properties_excluded`` are keyed by
    #: type, because a world narrows per type
    #: ([WO17](docs/for-developers/modules/govern/features/worlds.md)); a key
    #: nothing narrowed is absent rather than empty.
    applied: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{to, classes, cut}`` — what crossed, and what was cut from it.
    sent: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``{generated_sha256, executed_sha256}`` — **both**, so the connector's
    #: rewrite is visible rather than taken on trust. Digests, not queries: the
    #: text lives on the step, and duplicating it here would make this table a
    #: second copy of the trace instead of an index into it.
    query: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    @property
    def was_refused(self) -> bool:
        return self.direction == TouchDirection.refused.value

    def as_reading(self) -> dict[str, Any]:
        """The shape the run dashboard and `Compare` both read."""
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
            "volume": self.volume or {},
            "applied": self.applied or {},
            "sent": self.sent or {},
            "query": self.query or {},
            "cost_usd": self.cost_usd,
            "duration_ms": self.duration_ms,
        }
