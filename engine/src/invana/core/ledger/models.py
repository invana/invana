"""The ledger — every act by a person or an agent in a Graph (docs/for-developers/modules/operate/features/the-ledger.md).

One table, append-only, written by :func:`invana.core.ledger.writer.record` and
nothing else. Each row's ``hash`` covers its content and the previous row's
hash, so an edit anywhere breaks the chain from that row on. ``ledger_checks``
holds the last verification per Graph; ``ledger_exports`` the files people took.

There is no FK to ``task_runs`` or ``agents``: a row outlives what it names,
and names are snapshotted into ``actor_chain`` and ``touched`` when it is written.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base

#: The first row's ``prev_hash``.
GENESIS = "0" * 64


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class LedgerRow(Base):
    """One act: who, through which agents, what it touched, and the verdict."""

    __tablename__ = "ledger_rows"
    __table_args__ = (
        UniqueConstraint("graph_id", "seq", name="uq_ledger_rows_graph_seq"),
        Index("ix_ledger_rows_graph_at", "graph_id", "at"),
        Index("ix_ledger_rows_run", "run_id"),
        Index("ix_ledger_rows_touched", "graph_id", "touched"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    #: Position in the Graph's chain, from 1.
    seq: Mapped[int] = mapped_column(BigInteger, nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    #: ``person`` · ``agent`` · ``system``.
    actor_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    #: ``[{kind, id, name}]`` from the person at the root to the acting agent.
    actor_chain: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    #: The function called, or a person's act (``run.stop``, ``approval.approve``).
    act: Mapped[str] = mapped_column(String(128), nullable=False)
    #: ``graph`` · ``web`` · ``llm`` · ``secret`` · ``agent`` · ``run`` · ``lens`` · ``access`` · ``rule``.
    layer: Mapped[str] = mapped_column(String(16), nullable=False)
    #: ``layer/name`` — ``graph/Airport:LHR``, ``web/ba.com/fares``.
    touched: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    #: A short volume line: ``12 rows``, ``1.4k tokens``.
    touched_line: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    #: ``allowed`` · ``refused`` · ``approval`` · ``held``.
    verdict: Mapped[str] = mapped_column(String(16), nullable=False)
    #: On a refusal: ``grant`` · ``lens`` · ``ceiling`` · ``robots`` · ``policy``.
    refused_by: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: The rule that allowed or refused it, in words.
    rule: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    step_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    run_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: Where it ran: a worker, ``Studio``, ``Explorer``, ``control plane``.
    where: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    args: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class LedgerCheck(Base):
    """The last verification of one Graph's chain."""

    __tablename__ = "ledger_checks"

    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), primary_key=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ok: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: The last row verified.
    last_seq: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    #: The first row whose hash did not hold.
    broken_seq: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class LedgerExport(Base):
    """One export a person took: which rows, in which format."""

    __tablename__ = "ledger_exports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requested_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    #: The Rows filters, as the list contract named them.
    filters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: ``csv`` · ``jsonl``.
    format: Mapped[str] = mapped_column(String(8), nullable=False)
    rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
