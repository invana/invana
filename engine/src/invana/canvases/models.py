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

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
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
    # Name-keyed (not a type FK) so styling survives schema version bumps (RFC-019).
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
