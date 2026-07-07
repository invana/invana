"""SQLAlchemy async model for Explorer Canvases (RFC-043).

A ``Canvas`` is a *saved view* over a graph: the painted snapshot (nodes/edges),
the viewport, filters, node positions and visualization settings, plus a title
and a written purpose (``instructions``). Unlike a ``Session`` (a private
conversation), a canvas is **shared across every graph member**.

Each canvas is backed **1:1 by a Session** (``session_id`` unique + NOT NULL,
CASCADE): a new session yields at most one canvas, and deleting the session
deletes the canvas (RFC-043 Decision 2/3). The canvas is otherwise
**self-contained** — it carries its own ``snapshot`` + copied ``source_query``
so any member renders it without reading the private backing thread.
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
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from invana.modeller.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


def pack_json(obj: dict | None) -> bytes:
    """gzip a JSON object for compact at-rest storage (RFC-047 states)."""
    return gzip.compress(json.dumps(obj or {}, separators=(",", ":")).encode())


def unpack_json(blob: bytes | None) -> dict:
    """Inverse of :func:`pack_json`; an empty/absent blob decodes to ``{}``."""
    if not blob:
        return {}
    return json.loads(gzip.decompress(blob).decode())


class Canvas(Base):
    __tablename__ = "canvases"
    # The 1:1 backing guarantee: one session backs at most one canvas.
    __table_args__ = (UniqueConstraint("session_id", name="uq_canvases_session_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)

    # Hard 1:1 backing session (RFC-043 Decision 2). Unique + NOT NULL; CASCADE so
    # deleting the (private) session removes this (shared) canvas — the accepted
    # open risk in Decision 3.
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Denormalized so the shared list scopes by graph without joining through
    # ``sessions`` (whose visibility is per-creator).
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Provenance only — the canvas stays visible to every member regardless of
    # who created it (Decision 3). CASCADE with the creator like sessions.
    created_by_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    # The written "purpose" of the canvas.
    instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Self-contained render state (Decisions 3 + 4).
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {nodes, edges}
    source_query: Mapped[str | None] = mapped_column(Text, nullable=True)  # for "refresh from DB"
    view_state: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {zoom, pan, selectedId}
    filters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    positions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {nodeId: {x, y}}
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # {backend, magnet, ...}
    # Per node/edge-TYPE-NAME visual rules (RFC-045): {nodeTypes: {...}, edgeTypes: {...}}.
    # Name-keyed (not a type FK) so styling survives schema state bumps (RFC-019).
    styling: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Base64 PNG data URL of the downscaled canvas screenshot (RFC-045). Null
    # until first captured; excluded from the list summary (heavy).
    banner: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Organization flags, mirroring Session. Pinned floats to the top; archived is
    # a soft-hide excluded from the default list (Decision 9).
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    @property
    def has_banner(self) -> bool:
        """Whether a banner screenshot exists — surfaced in the list summary so
        rows can lazy-load the (heavy) image rather than shipping it inline."""
        return bool(self.banner)


class CanvasState(Base):
    """An immutable, point-in-time snapshot of a canvas (RFC-047).

    A state is captured **client-side** at each canvas-mutating turn — a query,
    a node expand (RFC-035), a load-to-canvas (RFC-033), or a manual "Save current
    state" — because the ``canvas.exportState()`` snapshot and ``banner`` image
    only exist in the browser's canvas engine. Rows are immutable (never edited);
    each canvas retains its newest ``INVANA_CANVAS_HISTORY_LIMIT`` states
    (default 30, 0 = keep all), pruned on insert — a bounded history the user can
    "go back in time" through. Going back **forks** a state into a fresh session +
    canvas, hydrated client-side via ``canvas.importState`` (no server endpoint);
    states are never restored in place.
    """

    __tablename__ = "canvas_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)

    # The canvas this is a state of. CASCADE — deleting the canvas drops its
    # history with it.
    canvas_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("canvases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalized (mirrors Canvas) so the admin view / scoping never joins.
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
    # The assistant turn that produced this state — provenance for explainability
    # (thread ↔ state). SET NULL so pruning a message never deletes the state;
    # provenance only, like ``Canvas.source_query`` (a member may not see the
    # private backing thread).
    message_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("session_messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    # What produced this state: "query" (composer NL/QL) | "expand" | "load".
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    # Human summary for the timeline, e.g. `Ran query — 42 nodes`.
    label: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    # The engine-native ``canvas.exportState()`` envelope (view + layer data with
    # positions), stored as gzipped JSON (RFC-047 storage optimisation) — it
    # compresses ~5-10x and these accumulate one row per turn. Read/written through
    # the `snapshot` property below, which (de)compresses transparently.
    snapshot_gz: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)  # gzip(exportState())
    source_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    styling: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Base64 PNG thumbnail — what makes the timeline visual. Excluded from the
    # list summary (heavy), like ``Canvas.banner``.
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
