"""Pydantic request/response models for the Boards API
(docs/for-developers/building-engine/boards-migration.md § 3.4)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.boards.kinds import BoardKindName, BoardVersionCause

# ── Requests ──────────────────────────────────────────────────────────────────


class BoardCreate(BaseModel):
    """Create a board.

    ``kind`` is set here and never changes (B1). ``session_id`` is provenance,
    not identity — a ``data`` board is created from a session, every other kind
    from its subject (B4).
    """

    kind: BoardKindName = "data"
    subject_id: str | None = Field(default=None, max_length=64)
    session_id: str | None = None
    title: str | None = Field(default=None, max_length=255)
    instructions: str | None = None
    # RULES
    settings: dict | None = None
    styling: dict | None = None
    view_state: dict | None = None
    filters: dict | None = None
    # DATA
    snapshot: dict | None = None
    positions: dict | None = None
    source_query: str | None = None


class BoardUpdate(BaseModel):
    """Partial update — any subset. An empty body is a no-op.

    ``kind`` and ``subject_id`` are absent by design: a board's identity is set
    at creation (B1). A recolour sends ``styling`` alone and the drawing is not
    rewritten (§ 3.4).
    """

    title: str | None = Field(default=None, min_length=1, max_length=255)
    instructions: str | None = None
    settings: dict | None = None
    styling: dict | None = None
    view_state: dict | None = None
    filters: dict | None = None
    snapshot: dict | None = None
    positions: dict | None = None
    source_query: str | None = None
    banner: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


# ── Reads ─────────────────────────────────────────────────────────────────────


class BoardSummary(BaseModel):
    """List-row shape — omits every heavy column (snapshot/positions/banner)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    kind: str
    #: Read from the registry, never stored (B3).
    renders: str
    subject_id: str | None = None
    session_id: str | None = None
    created_by_id: str
    title: str
    instructions: str
    settings: dict
    styling: dict
    has_banner: bool
    pinned: bool
    archived: bool
    created_at: datetime
    updated_at: datetime


class BoardDetail(BoardSummary):
    """Full board — everything needed to hydrate the surface."""

    snapshot: dict
    positions: dict
    view_state: dict
    filters: dict
    source_query: str | None = None
    banner: str | None = None


class BoardListResponse(BaseModel):
    items: list[BoardSummary]
    total: int


# ── Versions (§ 5.2) ──────────────────────────────────────────────────────────


class BoardVersionCreate(BaseModel):
    """One frozen reading of a board.

    The render state only exists in the client — a drawn board's
    ``canvas.exportState()``, a declared board's resolved ``DashboardSpec`` —
    so the client supplies it already merged, and the server never re-merges it
    (B16).
    """

    cause: BoardVersionCause
    label: str = Field(default="", max_length=255)
    snapshot: dict | None = None
    source_query: str | None = None
    styling: dict | None = None
    settings: dict | None = None
    banner: str | None = None
    node_count: int = 0
    edge_count: int = 0
    message_id: str | None = None


class BoardVersionSummary(BaseModel):
    """Timeline-row shape — omits the heavy blobs (snapshot/banner)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    board_id: str
    created_by_id: str
    message_id: str | None = None
    cause: str
    label: str
    node_count: int
    edge_count: int
    has_banner: bool
    created_at: datetime


class BoardVersionDetail(BoardVersionSummary):
    """Full version — the resolved document plus what it needs to stand alone."""

    snapshot: dict
    source_query: str | None = None
    styling: dict
    settings: dict
    banner: str | None = None


class BoardVersionListResponse(BaseModel):
    items: list[BoardVersionSummary]
    total: int
