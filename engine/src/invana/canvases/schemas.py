"""Pydantic request/response models for the Canvases API (RFC-043, RFC-047)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Requests ──────────────────────────────────────────────────────────────────


class CanvasCreate(BaseModel):
    """Create a canvas from an existing (backing) session.

    ``session_id`` is required (the hard 1:1 backing). Everything else is the
    live canvas state the client captured; ``title`` defaults from the session
    when omitted, ``source_query`` from its latest run.
    """

    session_id: str = Field(..., min_length=1)
    title: str | None = Field(default=None, max_length=255)
    instructions: str | None = None
    snapshot: dict | None = None
    source_query: str | None = None
    view_state: dict | None = None
    filters: dict | None = None
    positions: dict | None = None
    settings: dict | None = None
    styling: dict | None = None


class CanvasUpdate(BaseModel):
    """Partial update — any subset. An empty body is a no-op."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    instructions: str | None = None
    snapshot: dict | None = None
    source_query: str | None = None
    view_state: dict | None = None
    filters: dict | None = None
    positions: dict | None = None
    settings: dict | None = None
    styling: dict | None = None
    # Base64 PNG data URL of the canvas screenshot (RFC-045).
    banner: str | None = None
    pinned: bool | None = None
    archived: bool | None = None


# ── Reads ─────────────────────────────────────────────────────────────────────


class CanvasSummary(BaseModel):
    """List-row shape — omits the heavy render blobs (snapshot/positions)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    graph_id: str
    created_by_id: str
    title: str
    instructions: str
    styling: dict
    has_banner: bool
    pinned: bool
    archived: bool
    created_at: datetime
    updated_at: datetime


class CanvasDetail(CanvasSummary):
    """Full canvas — everything needed to hydrate the Explorer canvas."""

    snapshot: dict
    source_query: str | None = None
    view_state: dict
    filters: dict
    positions: dict
    settings: dict
    banner: str | None = None


class CanvasListResponse(BaseModel):
    items: list[CanvasSummary]
    total: int


# ── Canvas versions (RFC-047) ───────────────────────────────────────────────────


class CanvasStateCreate(BaseModel):
    """Client-captured snapshot of the canvas at a mutating turn.

    The render state (``snapshot``/``positions``/``banner``) only exists in the
    PixiJS renderer, so the client supplies it; ``kind`` + ``label`` describe the
    turn for the timeline; ``message_id`` links back to the producing thread turn.
    """

    kind: Literal["query", "expand", "load"]
    label: str = Field(default="", max_length=255)
    snapshot: dict | None = None
    positions: dict | None = None
    source_query: str | None = None
    styling: dict | None = None
    settings: dict | None = None
    banner: str | None = None
    node_count: int = 0
    edge_count: int = 0
    message_id: str | None = None


class CanvasStateSummary(BaseModel):
    """Timeline-row shape — omits the heavy render blobs (snapshot/positions/banner)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    canvas_id: str
    created_by_id: str
    message_id: str | None = None
    kind: str
    label: str
    node_count: int
    edge_count: int
    has_banner: bool
    created_at: datetime


class CanvasStateDetail(CanvasStateSummary):
    """Full state — everything needed to fork it into a new canvas."""

    snapshot: dict
    positions: dict
    source_query: str | None = None
    styling: dict
    settings: dict
    banner: str | None = None


class CanvasStateListResponse(BaseModel):
    items: list[CanvasStateSummary]
    total: int
