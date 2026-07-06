"""Pydantic request/response models for the Sessions API (RFC-024)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from invana.graph.types.constants import QueryLanguage
from invana.graphs.schemas import QueryResponse
from invana.sessions.models import SessionMessageRole, SessionMessageStatus

# ── Requests ──────────────────────────────────────────────────────────────────


class SendMessage(BaseModel):
    """One ask. `ql` runs the content as a query; `nl` translates it first (RFC-030)."""

    content: str = Field(..., min_length=1)
    mode: Literal["ql", "nl"] = "ql"
    language: QueryLanguage | None = None
    parameters: dict | None = None
    # nl only — which LLM provider to translate with; defaults to the graph's
    # is_default provider when omitted (RFC-030).
    llm_provider_id: str | None = None
    # How long (seconds) to budget this ask: the LLM translation (nl) and the
    # query execution (nl + ql). Lets slow models/queries be granted more time.
    # Falls back to the translate/driver defaults when omitted.
    timeout_s: float | None = Field(default=None, gt=0, le=600)


class SessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    # Which Studio surface this session lives on (RFC-031). ``modeller`` sessions
    # author a model draft; ``explorer`` (default) query the graph.
    surface: Literal["explorer", "modeller"] = "explorer"
    # Optional model binding for a modeller session — the draft to author. When
    # absent, the first generation creates + binds a model (RFC-031 Decision 2).
    model_id: str | None = None
    # Optional first message → create-and-send in one call (the "ask from the
    # list with no active session" UX).
    message: SendMessage | None = None


class SetFeedback(BaseModel):
    """A 👍/👎 vote on an assistant reply (RFC-038/039). ``None`` clears it."""

    value: Literal["up", "down"] | None = None


class RecordOperation(BaseModel):
    """A client-driven canvas operation to log as a session turn (RFC-046).

    Only ``load`` ("Load to canvas") is accepted here — no query executes, so the
    client supplies the referenced query + counts. ``expand`` is recorded
    server-side during the expand call, not through this endpoint.
    """

    kind: Literal["load"] = "load"
    source_query: str | None = None
    query_language: QueryLanguage | None = None
    row_count: int | None = Field(default=None, ge=0)
    node_count: int = Field(default=0, ge=0)
    edge_count: int = Field(default=0, ge=0)
    execution_time_ms: int | None = Field(default=None, ge=0)


class SessionUpdate(BaseModel):
    """Partial update for a session — rename and/or toggle pin/archive.

    All fields optional so callers can send just the bit they're changing
    (``{"pinned": true}`` from the row hover action, ``{"title": "..."}`` from
    a rename). An empty body is a no-op.
    """

    title: str | None = Field(default=None, min_length=1, max_length=255)
    pinned: bool | None = None
    archived: bool | None = None


# ── Reads ─────────────────────────────────────────────────────────────────────


class SessionMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    seq: int
    role: SessionMessageRole
    content: str
    status: SessionMessageStatus | None = None
    # "expand" | "load" when this turn is a canvas operation, not a composer query
    # (RFC-046). Null on a normal NL/QL turn.
    operation: str | None = None
    # "nl" | "ql" — how the ask was started, so the composer restores the mode on
    # reopen. Null on rows written before this field existed.
    mode: str | None = None
    via: str | None = None
    query_language: str | None = None
    source_query: str | None = None
    # NL clarification only — answer options the user can pick (RFC-038).
    clarification_options: list[str] | None = None
    # 👍/👎 on this reply (RFC-038/039). "up" | "down" | null.
    feedback: str | None = None
    row_count: int | None = None
    execution_time_ms: int | None = None
    llm_time_ms: int | None = None
    timeout_s: float | None = None
    node_count: int | None = None
    edge_count: int | None = None
    created_at: datetime


class SessionContextTurn(BaseModel):
    """One prior turn in the conversation context sent to the model (RFC-036/040).

    Structured so the UI can render with hierarchy rather than one blob. A turn is
    either a query turn (``query`` set) or a clarification turn (``question`` set,
    RFC-038). Same turns ``_assemble_history`` replays to the model.
    """

    prompt: str
    query: str = ""
    rationale: str = ""
    question: str = ""


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    # RFC-031: which surface + (modeller-only) the model this session authors, so
    # the FE can filter Explorer/Modeller lists and sync the canvas to the draft.
    surface: Literal["explorer", "modeller"] = "explorer"
    model_id: str | None = None
    title: str
    pinned: bool
    archived: bool
    message_count: int
    node_count: int
    edge_count: int
    # Status of the latest assistant reply — lets the list mark a session
    # failed/running without its messages. Null until the first reply lands.
    last_status: SessionMessageStatus | None = None
    created_at: datetime
    updated_at: datetime


class SessionDetail(SessionSummary):
    messages: list[SessionMessageRead] = []


class SessionListResponse(BaseModel):
    items: list[SessionSummary]
    total: int


# ── Action responses ────────────────────────────────────────────────────────


class SendMessageResponse(BaseModel):
    user_message: SessionMessageRead
    assistant_message: SessionMessageRead
    # null for nl, or when the query failed (the error is in assistant_message).
    result: QueryResponse | None = None


class RerunResponse(BaseModel):
    message: SessionMessageRead
    result: QueryResponse


class OperationResponse(BaseModel):
    """The user/assistant pair recorded for a canvas operation (RFC-046)."""

    user_message: SessionMessageRead
    assistant_message: SessionMessageRead
