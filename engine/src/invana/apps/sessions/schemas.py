"""Pydantic request/response models for the Sessions API (docs/for-developers/modules/ask/spec.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from invana.apps.graphs.schemas import QueryResponse
from invana.apps.sessions.models import SessionMessageRole, SessionMessageStatus
from invana.graph.types.constants import QueryLanguage
from invana.runtime.schemas import RunNodeRead

# ── Requests ──────────────────────────────────────────────────────────────────


class SendMessage(BaseModel):
    """One ask. `ql` runs the content as a query; `nl` translates it first
    (docs/for-developers/modules/ask/features/ask-in-natural-language.md)."""

    content: str = Field(..., min_length=1)
    mode: Literal["ql", "nl"] = "ql"
    language: QueryLanguage | None = None
    parameters: dict | None = None
    #: **Deprecated** (docs/for-developers/modules/agents/spec.md): the composer
    #: does not pick a model. The lens ``cast`` resolves it
    #: ([PM14](docs/for-developers/modules/agents/features/providers-and-models.md)),
    #: and this is ignored. Kept for one release so an older client still parses.
    llm_provider_id: str | None = None
    #: An explicit model for this one ask — an ``llm_models`` id. It still has
    #: to be one this Graph offers and it does **not** bypass the lens: a pick
    #: is a resolution, not a widening ([GV6](docs/for-developers/modules/govern/spec.md)).
    llm_model_id: str | None = None
    # How long (seconds) to budget this ask: the LLM translation (nl) and the
    # query execution (nl + ql). Lets slow models/queries be granted more time.
    # Falls back to the translate/driver defaults when omitted.
    timeout_s: float | None = Field(default=None, gt=0, le=600)
    #: The world this question is asked under
    #: ([C1](docs/for-developers/modules/govern/features/worlds.md)). Omitted is
    #: **Everything, inside the guardrails** — the default and the widest
    #: ([GV7](docs/for-developers/modules/govern/spec.md)), so no surface grows
    #: a required field. The run freezes what it resolves to; the id alone would
    #: be a pointer at a row that can move
    #: ([GR3](docs/for-developers/modules/govern/features/guardrails.md)).
    lens_id: str | None = Field(default=None, max_length=36)


class SessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    # Which Studio surface this session lives on (docs/for-developers/modules/ask/spec.md). ``modeller`` sessions
    # author a model draft; ``explorer`` (default) query the graph.
    surface: Literal["explorer", "modeller"] = "explorer"
    # The agent this thread thinks through (docs/for-developers/modules/agents/spec.md). Omitted means the
    # surface's default: Explorer → the graph's default agent, Modeller → the
    # seeded modeller.
    agent_id: str | None = None
    # Optional model binding for a modeller session — the draft to author. When
    # absent, the first generation creates + binds a model (docs/for-developers/modules/ask/spec.md).
    model_id: str | None = None
    # Optional first message → create-and-send in one call (the "ask from the
    # list with no active session" UX).
    message: SendMessage | None = None


class SetFeedback(BaseModel):
    """A 👍/👎 vote on an assistant reply (docs/for-developers/modules/ask/features/clarifying-questions.md ·
    docs/for-developers/modules/workflows/features/promote-a-plan.md). ``None`` clears it."""

    value: Literal["up", "down"] | None = None


class RecordOperation(BaseModel):
    """A client-driven canvas operation to log as a session turn
    (docs/for-developers/modules/explore/features/boards.md).

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
    # Takes effect on the **next** run_ask; earlier runs keep the agent
    # they ran under, because the run row is the record (docs/for-developers/modules/agents/spec.md).
    agent_id: str | None = None


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
    # (docs/for-developers/modules/explore/features/boards.md). Null on a normal NL/QL turn.
    operation: str | None = None
    # "nl" | "ql" — how the ask was started, so the composer restores the mode on
    # reopen. Null on rows written before this field existed.
    mode: str | None = None
    via: str | None = None
    query_language: str | None = None
    source_query: str | None = None
    # NL clarification only — answer options the user can pick
    # (docs/for-developers/modules/ask/features/clarifying-questions.md).
    clarification_options: list[str] | None = None
    # 👍/👎 on this reply (docs/for-developers/modules/ask/features/clarifying-questions.md ·
    # docs/for-developers/modules/workflows/features/promote-a-plan.md). "up" | "down" | null.
    feedback: str | None = None
    row_count: int | None = None
    execution_time_ms: int | None = None
    llm_time_ms: int | None = None
    timeout_s: float | None = None
    node_count: int | None = None
    edge_count: int | None = None
    # The run behind this reply and its task trace
    # (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) — one row per
    # attempt, from the reply's current run. Empty on user rows and on
    # replies from before the runtime existed.
    run_id: str | None = None
    steps: list[RunNodeRead] = []
    created_at: datetime


class SessionContextTurn(BaseModel):
    """One prior turn in the conversation context sent to the model (docs/for-developers/modules/ask/spec.md ·
    docs/for-developers/modules/ask/features/reasoning-trace.md).

    Structured so the UI can render with hierarchy rather than one blob. A turn is
    either a query turn (``query`` set) or a clarification turn (``question`` set,
    docs/for-developers/modules/ask/features/clarifying-questions.md). Same turns ``_assemble_history`` replays to the
    model.
    """

    prompt: str
    query: str = ""
    rationale: str = ""
    question: str = ""


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    # docs/for-developers/modules/ask/spec.md: which surface + (modeller-only) the model this session authors, so
    # the FE can filter Explorer/Modeller lists and sync the canvas to the draft.
    surface: Literal["explorer", "modeller"] = "explorer"
    # The agent this thread thinks through. The header shows the name; the
    # card names it on every reply (docs/for-developers/modules/agents/spec.md).
    agent_id: str | None = None
    agent_name: str | None = None
    # Set when the bound agent is paused or retired: the composer blocks and
    # offers the picker rather than silently answering with another mind.
    agent_status: str | None = None
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
    """202 — the ask is recorded and a run is running
    (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md). The reply
    settles over the run's stream; ``result`` is always null now and kept
    only so older clients keep parsing."""

    user_message: SessionMessageRead
    assistant_message: SessionMessageRead
    result: QueryResponse | None = None
    run_id: str | None = None
    stream_url: str | None = None


class RerunResponse(BaseModel):
    """202 — a new run is re-running the reply's query in place."""

    message: SessionMessageRead
    result: QueryResponse | None = None
    run_id: str | None = None
    stream_url: str | None = None


class OperationResponse(BaseModel):
    """The user/assistant pair recorded for a canvas operation
    (docs/for-developers/modules/explore/features/boards.md)."""

    user_message: SessionMessageRead
    assistant_message: SessionMessageRead
