"""SQLAlchemy async models for Boards (docs/for-developers/building-engine/boards-migration.md).

A ``Board`` is a **saved working surface**. Its ``kind`` is one flat axis of nine
values (§ 5), and whether the board is *drawn* or *declared* is ``renders`` — a
property of the kind in ``kinds.py``, never a column (B3).

Columns are grouped by **lifetime**, which is the only split that pays (B14):

===========  ===========================================================
``ID``       ``kind`` · ``subject_id`` · ``graph_id`` · ``session_id``
``RULES``    ``title`` · ``instructions`` · ``settings`` · ``styling`` ·
             ``view_state`` · ``filters`` — these survive a data replacement
``DATA``     ``snapshot`` · ``positions`` · ``banner`` — replaced by the next
             query
``ORG``      ``pinned`` · ``archived``
===========  ===========================================================

That is why ``styling`` is its own column: a re-query replaces every node and
**must not** discard the colours.

A **live dashboard has no row at all** (B9). It is derived from its subject on
every open; the row is created lazily by the first act that keeps something — a
saved report, which is one ``BoardVersion`` with ``cause="report"``.
"""

from __future__ import annotations

import gzip
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.apps.boards.kinds import BOARD_KINDS
from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


def pack_json(obj: dict | None) -> bytes:
    """gzip a JSON object for compact at-rest storage (§ 4.2)."""
    return gzip.compress(json.dumps(obj or {}, separators=(",", ":")).encode())


def unpack_json(blob: bytes | None) -> dict:
    """Inverse of :func:`pack_json`; an empty/absent blob decodes to ``{}``."""
    if not blob:
        return {}
    return json.loads(gzip.decompress(blob).decode())


class Board(Base):
    __tablename__ = "boards"
    __table_args__ = (
        # A session backs at most one board. NULL is not unique in either
        # backend, which is exactly the "0..1" this needs (B4).
        UniqueConstraint("session_id", name="uq_boards_session_id"),
        # A declared board is identified by what it is of, so the same run's
        # report never lands on two rows (B9).
        UniqueConstraint("graph_id", "kind", "subject_id", name="uq_boards_graph_kind_subject"),
        Index("ix_boards_graph_kind", "graph_id", "kind"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)

    # ── ID ───────────────────────────────────────────────────────────────────
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: One of ``kinds.BOARD_KINDS``. Set at creation, never changed (B1).
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="data")
    #: The record this board is *of*. A plain string, not a foreign key — it
    #: points at a different table per kind, and a polymorphic FK cannot be
    #: declared. A deleted subject leaves a board that reads *this run is gone*
    #: rather than a cascade that removes what someone pinned (B8).
    subject_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    #: Provenance, not identity (B4). Nullable: only a ``data`` board is created
    #: from a session. CASCADE, so deleting the private session removes the
    #: shared board it backed.
    session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Provenance only — the board stays visible to every member regardless of
    # who created it.
    created_by_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── RULES — survive every data replacement ───────────────────────────────
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)
    #: The person's *reading* of the board — a canvas's backend and magnet, a
    #: dashboard's open view. Whatever the spec builder takes besides the
    #: subject belongs here, and nothing else about a live dashboard is stored
    #: at all (B15).
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: Per node/edge-TYPE-NAME visual rules. Name-keyed (not a type FK) so
    #: styling survives schema state bumps — and survives a re-query, which is
    #: the whole reason it is not inside ``snapshot``.
    styling: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    view_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {zoom, pan, selectedId}
    filters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # ── DATA — replaced by the next query ────────────────────────────────────
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {items}
    positions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {nodeId: {x, y}}
    source_query: Mapped[str | None] = mapped_column(Text, nullable=True)  # for "refresh from DB"
    #: Base64 PNG data URL of the downscaled screenshot. Null until first
    #: captured; excluded from the list summary (heavy).
    banner: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── ORG ──────────────────────────────────────────────────────────────────
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    @property
    def renders(self) -> str:
        """``canvas`` or ``dashboard`` — read from the registry, never stored."""
        spec = BOARD_KINDS.get(self.kind)
        return spec.renders if spec else "canvas"

    @property
    def has_banner(self) -> bool:
        """Whether a banner exists — surfaced in the list summary so rows can
        lazy-load the (heavy) image rather than shipping it inline."""
        return bool(self.banner)


class BoardVersion(Base):
    """One immutable, point-in-time reading of a board (§ 5.2).

    A **version** on a drawn board and a **report** on a declared one are the
    same row: the product word is *version*, above and below (B6). What differs
    is only what ``snapshot_gz`` holds — ``canvas.exportState()`` for a drawing,
    the resolved ``DashboardSpec`` for a report.

    A frozen reading is stored **merged and never re-merged** (B16): the report
    carries the numbers inside it, so it renders with no fetch and outlives its
    run's pruned ``result.json``. The ``styling`` and ``settings`` beside the
    blob are a deliberate copy, so a version lists and reads without its board.

    Rows are immutable. Each board retains its newest
    ``INVANA_BOARD_HISTORY_LIMIT`` versions (default 30, 0 = keep all), pruned on
    insert. Going back **forks** into a fresh board; versions are never restored
    in place.
    """

    __tablename__ = "board_versions"
    __table_args__ = (Index("ix_board_versions_board_created", "board_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)

    board_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalized (mirrors Board) so the admin view / scoping never joins.
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The assistant turn that produced this reading — provenance for
    # explainability. SET NULL so pruning a message never deletes the version.
    message_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("session_messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    #: Why it was written: ``query`` · ``expand`` · ``load`` · ``manual`` ·
    #: ``report``. Named ``cause`` because ``kind`` means the board's kind now,
    #: and two ``kind`` columns in one module is a bug waiting for a join (B7).
    cause: Mapped[str] = mapped_column(String(16), nullable=False)
    #: Human summary for the timeline, e.g. ``Ran query — 42 nodes``.
    label: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    #: gzip of the resolved document — ``canvas.exportState()`` or a
    #: ``DashboardSpec``. It compresses ~5-10x and these accumulate one row per
    #: meaningful change. Read through the ``snapshot`` property below.
    snapshot_gz: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    source_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    styling: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    #: Base64 PNG thumbnail — what makes the timeline visual. Excluded from the
    #: list summary (heavy), like ``Board.banner``.
    banner: Mapped[str | None] = mapped_column(Text, nullable=True)

    node_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    edge_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    @property
    def snapshot(self) -> dict:
        return unpack_json(self.snapshot_gz)

    @property
    def has_banner(self) -> bool:
        return bool(self.banner)
