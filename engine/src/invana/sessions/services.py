"""Service layer for Query Sessions (RFC-024).

Owns session/message persistence and orchestrates query execution via the
shared ``execute_query`` service. Sessions are private to their creator and
graph-scoped; ``get_or_404`` enforces both.
"""

from __future__ import annotations

import time
from contextlib import nullcontext
from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.events import actions
from invana.events.services import current_trace_id, emit_event
from invana.graph.connectors.base.exceptions import QueryErrorCategory
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph
from invana.graphs.query_service import QueryExecutionError, execute_query, resolve_query_language
from invana.graphs.schemas import QueryResponse
from invana.llm import LLMError
from invana.llm.propose import propose_model, validate_proposal
from invana.llm.translate import Clarification, nl_to_query
from invana.llm_providers.models import LLMProvider
from invana.llm_providers.store import LLMProviderStore
from invana.modeller.models import GraphModel, GraphVersion
from invana.modeller.store import ModelStore
from invana.sessions.models import (
    Session,
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
    SessionSurface,
)
from invana.sessions.reconcile import reconcile_proposal
from invana.sessions.schemas import RecordOperation, SendMessage
from invana.sessions.store import SessionStore
from invana.telemetry.recorders import add_message_in_flight, record_session_message

# OpenTelemetry lives in the optional ``telemetry`` extra (RFC-007/025); this
# module must import cleanly without it. Resolve a tracer lazily and fall back to
# no-op spans — the ``session.message`` span is the parent that ties the LLM
# translate (``llm.generate``) and query (``graph.query.*``) child spans into one
# end-to-end unit (RFC-041).
try:
    from opentelemetry import trace as _otel_trace

    _tracer = _otel_trace.get_tracer("invana.sessions")
except ImportError:  # telemetry extra not installed
    _tracer = None


def _message_span(name: str):
    """Start an OTel span for a message round-trip, or a no-op without telemetry."""
    if _tracer is None:
        return nullcontext(None)
    return _tracer.start_as_current_span(name)


def _message_metric_status(msg: SessionMessage) -> str:
    """Bucket a finished assistant message for metric labels (RFC-041).

    ``error`` on failure, ``clarify`` when it asked a question instead of running,
    else ``ok``.
    """
    if msg.status == SessionMessageStatus.error:
        return "error"
    if getattr(msg, "clarification_options", None):
        return "clarify"
    return "ok"


_LANGUAGE_LABEL = {"cypher": "Cypher", "gremlin": "Gremlin"}

# How many prior turns to replay as conversation context for an NL ask (RFC-036),
# so a follow-up like "only show 5" can refine the previous query. Bounded to keep
# the prompt small; this is read-only translation, so the risk is low.
_HISTORY_TURNS = 6

# Backend-owned copy for NL-mode failures (RFC-028). The user typed a question,
# not a query, so the raw driver error (a Cypher/Gremlin parser message) is
# meaningless to them — show guidance keyed off the failure category instead.
# The real error is still captured in the audit event + OTel span for review.
_FRIENDLY_QUERY_ERROR = {
    QueryErrorCategory.SYNTAX: (
        "I couldn't turn that into a query I can run. Try rephrasing, adding more detail, or narrowing your question."
    ),
    QueryErrorCategory.TIMEOUT: "That took too long to answer. Try narrowing it down or being more specific.",
}
_FRIENDLY_QUERY_ERROR_DEFAULT = "I couldn't get an answer for that. Try rephrasing or narrowing your question."


def _friendly_query_error(category: str) -> str:
    """User-facing copy for an NL ask whose generated query failed to execute."""
    return _FRIENDLY_QUERY_ERROR.get(category, _FRIENDLY_QUERY_ERROR_DEFAULT)


def _title_from_text(text: str) -> str:
    clean = " ".join(text.split())
    if not clean:
        return "New session"
    return f"{clean[:64]}…" if len(clean) > 64 else clean


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def _summary(result: QueryResponse, nodes: int, edges: int) -> str:
    if result.result_type == "graph":
        return f"Returned {_plural(nodes, 'node')} and {_plural(edges, 'relationship')}."
    return f"Returned {_plural(result.row_count, 'row')}."


def _values_from_result(result: QueryResponse, limit: int = 10) -> list[str]:
    """First-column values of a tabular result — the picks for a clarification.

    Used to turn a clarification's ``options_query`` (e.g. DISTINCT countries)
    into concrete options. De-duplicated, capped, order preserved.
    """
    out: list[str] = []
    for row in result.rows or []:
        value = next(iter(row.values()), None) if row else None
        text = str(value).strip() if value is not None else ""
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out


def _context_turns(rows: list[SessionMessage]) -> list[dict]:
    """Prior successful turns as structured ``{prompt, query, rationale}`` (RFC-036).

    Pairs each user prompt with the assistant's generated query (and rationale,
    when present). Only ``ok`` turns that carry a ``source_query`` contribute —
    ``nl`` and ``ql`` alike, so a follow-up can refine a hand-typed query too.
    Orphaned user turns (whose assistant reply failed or is still running) are
    dropped, keeping the sequence a clean alternation. This is the single source
    of truth for both the replayed history (``_assemble_history``) and the UI
    disclosure (RFC-040).
    """
    turns: list[dict] = []
    pending_user: str | None = None
    for m in rows:  # ascending seq
        # Canvas operations (expand/load) are not conversational turns (RFC-046) —
        # their generated traversal must never leak into NL translation context.
        # Skipping both rows of the pair also clears any pending user prompt, but
        # a real query's prompt is always immediately followed by its own reply,
        # never an operation, so nothing legitimate is dropped.
        if m.operation is not None:
            pending_user = None
            continue
        if m.role == SessionMessageRole.user:
            pending_user = m.content
        elif (
            m.role == SessionMessageRole.assistant and m.status == SessionMessageStatus.ok and pending_user is not None
        ):
            if m.source_query:
                turns.append(
                    {"kind": "query", "prompt": pending_user, "query": m.source_query, "rationale": m.rationale or ""}
                )
            else:
                # A clarification reply (RFC-038): no query ran; its content is the
                # question. Replayed so the model remembers what it asked.
                turns.append({"kind": "clarify", "prompt": pending_user, "question": m.content})
            pending_user = None
        else:
            pending_user = None
    return turns


def _assemble_history(rows: list[SessionMessage]) -> list[dict]:
    """Structured prior turns → provider-agnostic chat messages (RFC-036).

    Plain text, not tool_use/tool_result blocks: those are provider-specific,
    whereas user/assistant text serializes identically across every provider
    ``complete_tool`` dispatches to. The current turn still emits via the forced
    ``submit_query`` tool; the clean user/assistant alternation satisfies the
    strictest provider (Anthropic).
    """
    out: list[dict] = []
    for t in _context_turns(rows):
        if t["kind"] == "query":
            content = f"{t['query']}\n-- {t['rationale']}" if t["rationale"] else t["query"]
        else:  # clarify — the assistant asked a question instead of querying
            content = t["question"]
        out.append({"role": "user", "content": t["prompt"]})
        out.append({"role": "assistant", "content": content})
    return out


# ── Reads ─────────────────────────────────────────────────────────────────────


async def list_sessions(
    session: AsyncSession,
    *,
    graph_id: str,
    user_id: str,
    limit: int,
    offset: int,
    sort: str = "updated",
    include_archived: bool = False,
    surface: str | None = None,
) -> tuple[list[Session], int]:
    store = SessionStore()
    items = await store.list_for_user(
        session,
        graph_id=graph_id,
        user_id=user_id,
        limit=limit,
        offset=offset,
        sort=sort,
        include_archived=include_archived,
        surface=surface,
    )
    total = await store.count_for_user(
        session, graph_id=graph_id, user_id=user_id, include_archived=include_archived, surface=surface
    )
    return items, total


async def get_or_404(
    session: AsyncSession,
    *,
    session_id: str,
    graph_id: str,
    user_id: str,
) -> Session:
    """Fetch a session, enforcing graph scope + private-to-creator visibility."""
    sess = await SessionStore().get(session, session_id)
    if sess is None or sess.graph_id != graph_id or sess.created_by_id != user_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Session not found.")
    return sess


async def list_messages(session: AsyncSession, *, sess: Session) -> list[SessionMessage]:
    return await SessionStore().list_messages(session, session_id=sess.id)


async def get_message_or_404(
    session: AsyncSession,
    *,
    message_id: str,
    sess: Session,
) -> SessionMessage:
    msg = await SessionStore().get_message(session, message_id)
    if msg is None or msg.session_id != sess.id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Message not found.")
    return msg


async def set_feedback(session: AsyncSession, *, message: SessionMessage, value: str | None) -> SessionMessage:
    """Record a 👍/👎 vote on an assistant reply (RFC-038/039) — the capture
    signal the learning loop will later distil. ``None`` clears the vote."""
    message.feedback = value
    await session.flush()
    return message


async def get_message_context(session: AsyncSession, *, message: SessionMessage) -> list[dict]:
    """Recompute the conversation context (RFC-036) sent for an assistant turn.

    Reuses the exact functions ``send_message`` uses, so the result is identical
    to what was replayed to the model — see RFC-040. Empty for a user message, a
    non-``nl`` reply (ql turns send no context), or a first turn. ``before_seq``
    is ``message.seq - 1`` (the triggering user turn's seq), matching the window
    ``send_message`` built.
    """
    if message.role != SessionMessageRole.assistant or message.mode != "nl":
        return []
    rows = await SessionStore().list_recent_messages(
        session, session_id=message.session_id, before_seq=message.seq - 1, limit=_HISTORY_TURNS * 2
    )
    return _context_turns(rows)


# ── Writes ────────────────────────────────────────────────────────────────────


async def create_session(
    session: AsyncSession,
    *,
    graph_id: str,
    user_id: str,
    title: str | None,
    surface: str = "explorer",
    model_id: str | None = None,
) -> Session:
    # A modeller session may bind to a model up front (RFC-031 Decision 2). Re-scope
    # to the route's graph so a cross-graph model id 404s rather than leaks. An
    # introspected ("global") model is read-only — never an authoring target; drop
    # the binding and let the first generation create a fresh studio model.
    if model_id is not None:
        model = await ModelStore().get_graph_model(session, model_id)
        if model is None or model.graph_id != graph_id:
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Model not found for this graph.")
        if model.origin == "introspected":
            model_id = None
    sess = Session(
        graph_id=graph_id,
        created_by_id=user_id,
        title=title or "",
        surface=SessionSurface(surface),
        model_id=model_id,
    )
    await SessionStore().add(session, sess)
    await emit_event(
        session,
        action=actions.SESSION_CREATE,
        target_kind=actions.TARGET_SESSION,
        target_id=sess.id,
        graph_id=graph_id,
        actor_id=user_id,
        details={},
        trace_id=current_trace_id(),
    )
    return sess


async def rename_session(session: AsyncSession, *, sess: Session, title: str) -> Session:
    sess.title = title
    await session.flush()
    return sess


async def update_session(
    session: AsyncSession,
    *,
    sess: Session,
    title: str | None = None,
    pinned: bool | None = None,
    archived: bool | None = None,
) -> Session:
    """Apply a partial update (only the provided fields) to a session."""
    if title is not None:
        sess.title = title
    if pinned is not None:
        sess.pinned = pinned
    if archived is not None:
        sess.archived = archived
    await session.flush()
    return sess


async def delete_session(session: AsyncSession, *, sess: Session, actor_id: str) -> None:
    session_id = sess.id
    graph_id = sess.graph_id
    await SessionStore().delete(session, sess)
    await emit_event(
        session,
        action=actions.SESSION_DELETE,
        target_kind=actions.TARGET_SESSION,
        target_id=session_id,
        graph_id=graph_id,
        actor_id=actor_id,
        details={},
        trace_id=current_trace_id(),
    )


async def _resolve_provider(session: AsyncSession, *, graph_id: str, llm_provider_id: str | None) -> LLMProvider:
    """Pick the provider to translate with: explicit id → graph default → 422."""
    store = LLMProviderStore()
    if llm_provider_id:
        provider = await store.get(session, llm_provider_id)
        if provider is None or provider.graph_id != graph_id:
            raise HTTPException(
                status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
                detail="That LLM provider was not found for this graph.",
            )
        return provider
    providers = await store.list_for_graph(session, graph_id)
    default = next((p for p in providers if p.is_default), None)
    if default is None:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail="No LLM provider is configured for this graph — add one in Settings → LLMs.",
        )
    return default


async def _grounding_version(session: AsyncSession, graph_id: str) -> GraphVersion | None:
    """The active model version to ground against — the introspected/global model
    first (it mirrors the live DB), else any model's active version."""
    store = ModelStore()
    introspected = await store.get_introspected_model(session, graph_id)
    if introspected is not None:
        version = await store.get_active_version(session, introspected.id)
        if version is not None:
            return version
    for model in await store.list_graph_models(session, graph_id):
        version = await store.get_active_version(session, model.id)
        if version is not None:
            return version
    return None


async def _finalize_totals(
    session: AsyncSession, sess: Session, assistant_msg: SessionMessage, payload: SendMessage
) -> None:
    sess.message_count += 2
    # The assistant reply is always the newest message, so its status is the
    # session's latest status (drives the list's failed/running indicator).
    sess.last_status = assistant_msg.status
    if not sess.title:
        sess.title = _title_from_text(payload.content)
    await session.flush()


async def record_operation(
    session: AsyncSession,
    *,
    sess: Session,
    kind: str,
    user_content: str,
    summary: str,
    source_query: str | None = None,
    query_language: str | None = None,
    row_count: int | None = None,
    execution_time_ms: int | None = None,
    node_count: int = 0,
    edge_count: int = 0,
    add_to_totals: bool = False,
) -> tuple[SessionMessage, SessionMessage]:
    """Append a canvas-operation turn (RFC-046) — a user/assistant pair whose
    ``operation`` marks it as an expand/load rather than a composer query.

    Reuses the assistant reply's existing result fields so the thread renders it
    like any query turn (summary + "View query" + meta). ``add_to_totals`` grows
    the session's node/edge running totals — true for an ``expand`` (the canvas
    genuinely grew), false for a ``load`` (those rows were counted when the query
    first ran; re-projecting must not double-count).
    """
    store = SessionStore()
    user_seq = await store.next_seq(session, session_id=sess.id)
    user_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq,
        role=SessionMessageRole.user,
        content=user_content,
        operation=kind,
    )
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content=summary,
        status=SessionMessageStatus.ok,
        operation=kind,
        mode="ql",
        via=_LANGUAGE_LABEL.get(query_language, query_language) if query_language else None,
        query_language=query_language,
        source_query=source_query,
        row_count=row_count,
        execution_time_ms=execution_time_ms,
        node_count=node_count,
        edge_count=edge_count,
    )
    await store.add(session, user_msg)
    await store.add(session, assistant_msg)
    sess.message_count += 2
    sess.last_status = assistant_msg.status
    if add_to_totals:
        sess.node_count += node_count
        sess.edge_count += edge_count
    await session.flush()
    return user_msg, assistant_msg


async def record_load(
    session: AsyncSession, *, sess: Session, payload: RecordOperation
) -> tuple[SessionMessage, SessionMessage]:
    """Log a "Load to canvas" click as a session turn (RFC-046).

    ``add_to_totals`` is false: the loaded query's rows were already counted when
    it first ran, so re-projecting them must not double the session's totals.
    """
    summary = (
        f"Loaded {_plural(payload.node_count, 'node')} and "
        f"{_plural(payload.edge_count, 'relationship')} onto the canvas."
    )
    return await record_operation(
        session,
        sess=sess,
        kind="load",
        user_content="Load to canvas",
        summary=summary,
        source_query=payload.source_query,
        query_language=payload.query_language.value if payload.query_language else None,
        row_count=payload.row_count,
        execution_time_ms=payload.execution_time_ms,
        node_count=payload.node_count,
        edge_count=payload.edge_count,
        add_to_totals=False,
    )


# ── Modeller generation (RFC-031) ──────────────────────────────────────────────


def _model_summary(summary: str, counts: dict[str, int]) -> str:
    """Assistant reply for a generation turn: the model's summary + what was added.

    Backend-owned message (RFC-028) so the FE needs no extra fields — the counts
    ride the existing ``content``. The "Added …" line is appended only when
    something new was created (a pure refinement of existing types shows just the
    summary)."""
    parts = []
    if counts["node_types"]:
        parts.append(_plural(counts["node_types"], "node type"))
    if counts["edge_types"]:
        parts.append(_plural(counts["edge_types"], "edge type"))
    if counts["property_keys"]:
        parts.append(_plural(counts["property_keys"], "property key"))
    if parts:
        return f"{summary}\n\nAdded {', '.join(parts)}."
    return summary


async def _ensure_model_and_draft(
    session: AsyncSession, *, sess: Session, graph: Graph, prompt: str
) -> tuple[GraphModel, GraphVersion]:
    """Resolve the model + editable draft a modeller session authors (RFC-031 D2).

    Bound session → load its model + draft (creating a draft if it has none).
    Unbound (or bound to a deleted/read-only model) → create a fresh studio model
    + initial draft and bind the session to it. Returns the eager-loaded draft so
    the proposal can ground + reconcile against it.
    """
    store = ModelStore()
    model: GraphModel | None = None
    if sess.model_id:
        model = await store.get_graph_model(session, sess.model_id)
        # Defensive: a dangling/cross-graph/read-only binding falls through to a
        # fresh studio model rather than authoring somewhere it shouldn't.
        if model is not None and (model.graph_id != graph.id or model.origin == "introspected"):
            model = None

    if model is None:
        model = await store.create_graph_model(
            session, name=_title_from_text(prompt), graph_id=graph.id, origin="studio"
        )
        sess.model_id = model.id
        draft = await store.create_version(session, model_id=model.id)
    else:
        draft = next((v for v in model.versions if v.status == "draft"), None)
        if draft is None:
            draft = await store.create_version(session, model_id=model.id)

    # Reload eager so node/edge types + property keys are available for grounding
    # + the by-name reconcile diff (create_version returns an unloaded version).
    eager = await store.get_version(session, draft.id)
    assert eager is not None  # just created/loaded in this transaction
    return model, eager


async def _send_modeller_message(
    session: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    payload: SendMessage,
    actor_id: str,
    encryption_key: str,
) -> tuple[SessionMessage, SessionMessage, None]:
    """NL prompt → proposed model → reconciled into the session's draft (RFC-031).

    Mirrors the NL branch of ``send_message`` but authors a model instead of
    running a query: resolve provider → ensure model+draft → propose → validate
    (no mutation on failure) → reconcile into the draft → summary reply. Always
    returns ``None`` for the result (there is nothing to render on the canvas
    beyond the refreshed draft)."""
    if payload.mode == "ql":
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail="Modeller sessions author a model — query mode isn't available here.",
        )

    store = SessionStore()
    # Resolve up front so a missing-provider 422 rolls back before any write.
    provider = await _resolve_provider(session, graph_id=graph.id, llm_provider_id=payload.llm_provider_id)

    user_seq = await store.next_seq(session, session_id=sess.id)
    user_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq,
        role=SessionMessageRole.user,
        content=payload.content,
    )
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content="Generating model…",
        status=SessionMessageStatus.running,
        mode="nl",
    )
    await store.add(session, user_msg)
    await store.add(session, assistant_msg)

    model, draft = await _ensure_model_and_draft(session, sess=sess, graph=graph, prompt=payload.content)

    # Replay prior turns so a follow-up ("add a Company") refines the same draft.
    history = _assemble_history(
        await store.list_recent_messages(session, session_id=sess.id, before_seq=user_seq, limit=_HISTORY_TURNS * 2)
    )

    try:
        proposal = await propose_model(
            provider=provider,
            prompt=payload.content,
            version=draft,
            encryption_key=encryption_key,
            history=history,
            **({"timeout_s": payload.timeout_s} if payload.timeout_s is not None else {}),
        )
    except LLMError as exc:
        assistant_msg.status = SessionMessageStatus.error
        assistant_msg.content = exc.message
        await _finalize_totals(session, sess, assistant_msg, payload)
        return user_msg, assistant_msg, None

    if isinstance(proposal, Clarification):
        assistant_msg.status = SessionMessageStatus.ok
        assistant_msg.content = proposal.question
        assistant_msg.clarification_options = list(proposal.options) or None
        assistant_msg.via = f"{provider.provider.value} · {provider.model_id}"
        assistant_msg.llm_time_ms = round(proposal.duration_ms)
        assistant_msg.timeout_s = payload.timeout_s
        await emit_event(
            session,
            action=actions.LLM_TRANSLATE,
            target_kind=actions.TARGET_SESSION,
            target_id=sess.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={
                "provider": provider.provider.value,
                "model_id": provider.model_id,
                "action": "clarify",
                "question": proposal.question,
                "input_tokens": proposal.usage.input_tokens,
                "output_tokens": proposal.usage.output_tokens,
                "duration_ms": round(proposal.duration_ms),
            },
            trace_id=current_trace_id(),
        )
        await _finalize_totals(session, sess, assistant_msg, payload)
        return user_msg, assistant_msg, None

    # Referential integrity BEFORE any draft mutation (RFC-031 Decision 9).
    existing_names = {nt.name for nt in draft.node_types}
    try:
        validate_proposal(proposal, existing_node_type_names=existing_names)
    except LLMError as exc:
        assistant_msg.status = SessionMessageStatus.error
        assistant_msg.content = exc.message
        await _finalize_totals(session, sess, assistant_msg, payload)
        return user_msg, assistant_msg, None

    counts = await reconcile_proposal(session, store=ModelStore(), version=draft, proposal=proposal)

    assistant_msg.status = SessionMessageStatus.ok
    assistant_msg.via = f"{provider.provider.value} · {provider.model_id}"
    assistant_msg.llm_time_ms = round(proposal.duration_ms)
    assistant_msg.timeout_s = payload.timeout_s
    assistant_msg.content = _model_summary(proposal.summary, counts)
    await emit_event(
        session,
        action=actions.MODEL_GENERATE,
        target_kind=actions.TARGET_SESSION,
        target_id=sess.id,
        graph_id=graph.id,
        actor_id=actor_id,
        details={
            "provider": provider.provider.value,
            "model_id": provider.model_id,
            "model_id_target": model.id,
            "node_type_count": counts["node_types"],
            "edge_type_count": counts["edge_types"],
            "property_key_count": counts["property_keys"],
            "input_tokens": proposal.usage.input_tokens,
            "output_tokens": proposal.usage.output_tokens,
            "latency_ms": round(proposal.duration_ms),
        },
        trace_id=current_trace_id(),
    )
    await _finalize_totals(session, sess, assistant_msg, payload)
    return user_msg, assistant_msg, None


async def send_message(
    session: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    manager: GraphConnectionManager,
    payload: SendMessage,
    actor_id: str,
    encryption_key: str,
) -> tuple[SessionMessage, SessionMessage, QueryResponse | None]:
    """Append a user message + assistant reply, then run a query.

    Thin observability wrapper (RFC-041): opens the ``session.message`` parent
    span and emits ``invana.session.message.*`` metrics around the orchestration
    in :func:`_send_message_impl`, so a whole NL/QL turn is one trace and its
    end-to-end latency is aggregatable by ``mode`` / ``surface`` / ``status``.
    """
    mode = payload.mode
    surface = sess.surface.value
    add_message_in_flight(1, mode=mode, surface=surface)
    start = time.perf_counter()
    status = "error"  # default so an unexpected raise is counted as an error
    with _message_span("session.message") as span:
        if span is not None:
            span.set_attribute("invana.session.mode", mode)
            span.set_attribute("invana.session.surface", surface)
        try:
            user_msg, assistant_msg, result = await _send_message_impl(
                session,
                sess=sess,
                graph=graph,
                manager=manager,
                payload=payload,
                actor_id=actor_id,
                encryption_key=encryption_key,
            )
            status = _message_metric_status(assistant_msg)
            if span is not None:
                span.set_attribute("invana.session.status", status)
            return user_msg, assistant_msg, result
        finally:
            record_session_message(
                mode=mode, surface=surface, duration_ms=(time.perf_counter() - start) * 1000, status=status
            )
            add_message_in_flight(-1, mode=mode, surface=surface)


async def _send_message_impl(
    session: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    manager: GraphConnectionManager,
    payload: SendMessage,
    actor_id: str,
    encryption_key: str,
) -> tuple[SessionMessage, SessionMessage, QueryResponse | None]:
    """Append a user message + assistant reply, then run a query.

    ``ql`` runs the content directly; ``nl`` translates it to a grounded
    read-only query first (RFC-030) and runs that. *Config* failures (no
    provider / no connection / read-only) raise ``HTTPException`` so the caller
    rolls back and nothing persists; *translation* and *execution* failures are
    recorded as an error assistant message (committed).
    """
    store = SessionStore()

    # A modeller session authors a model draft (RFC-031), not a query — branch off
    # to the generation path. Query mode isn't available there.
    if sess.surface == SessionSurface.modeller:
        return await _send_modeller_message(
            session,
            sess=sess,
            graph=graph,
            payload=payload,
            actor_id=actor_id,
            encryption_key=encryption_key,
        )

    is_ql = payload.mode == "ql"

    # Resolve the provider up front for nl so a missing-provider 422 rolls back
    # before any message is written.
    provider = (
        None if is_ql else await _resolve_provider(session, graph_id=graph.id, llm_provider_id=payload.llm_provider_id)
    )

    user_seq = await store.next_seq(session, session_id=sess.id)
    user_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq,
        role=SessionMessageRole.user,
        content=payload.content,
    )
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content="Running query…",
        status=SessionMessageStatus.running,
        # Set at creation so it survives every exit path (translation error,
        # execution error, ok) — the composer reads it to restore the mode.
        mode=payload.mode,
    )
    await store.add(session, user_msg)
    await store.add(session, assistant_msg)

    # Decide what to run and how to label its origin.
    query_to_run: str | None = payload.content if is_ql else None
    via_label: str | None = None  # nl → model id; ql → filled from the result language

    if not is_ql:
        language = (await resolve_query_language(session, graph=graph, manager=manager)).value
        # Replay a bounded window of prior turns so a follow-up ("only show 5")
        # refines the previous query rather than translating from scratch
        # (RFC-036). before_seq=user_seq excludes the two rows just inserted.
        history = _assemble_history(
            await store.list_recent_messages(session, session_id=sess.id, before_seq=user_seq, limit=_HISTORY_TURNS * 2)
        )
        try:
            generated = await nl_to_query(
                provider=provider,
                prompt=payload.content,
                language=language,
                version=await _grounding_version(session, graph.id),
                encryption_key=encryption_key,
                history=history,
                # None → let nl_to_query apply its own default.
                **({"timeout_s": payload.timeout_s} if payload.timeout_s is not None else {}),
            )
        except LLMError as exc:
            assistant_msg.status = SessionMessageStatus.error
            assistant_msg.content = exc.message
            await _finalize_totals(session, sess, assistant_msg, payload)
            return user_msg, assistant_msg, None
        if isinstance(generated, Clarification):
            # Genuinely ambiguous ask (RFC-038): persist the question as the reply
            # and run nothing. No source_query marks this as a clarification turn —
            # _context_turns replays it so the model remembers what it asked when
            # the user answers next.
            # Prefer data-driven options: run the model's read-only options_query
            # to offer real values from the graph (e.g. countries). Fall back to
            # the model's fixed options if it has none or the query fails.
            options = list(generated.options)
            if generated.options_query:
                try:
                    opt_result = await execute_query(
                        session,
                        graph=graph,
                        manager=manager,
                        query=generated.options_query,
                        parameters=None,
                        actor_id=actor_id,
                        session_id=sess.id,
                        timeout_s=payload.timeout_s,
                    )
                    fetched = _values_from_result(opt_result)
                    if fetched:
                        options = fetched
                except QueryExecutionError:
                    pass  # keep the fixed options / question-only
            assistant_msg.status = SessionMessageStatus.ok
            assistant_msg.content = generated.question
            assistant_msg.clarification_options = options or None
            assistant_msg.via = f"{provider.provider.value} · {provider.model_id}"
            assistant_msg.llm_time_ms = round(generated.duration_ms)
            assistant_msg.timeout_s = payload.timeout_s
            await emit_event(
                session,
                action=actions.LLM_TRANSLATE,
                target_kind=actions.TARGET_SESSION,
                target_id=sess.id,
                graph_id=graph.id,
                actor_id=actor_id,
                details={
                    "provider": provider.provider.value,
                    "model_id": provider.model_id,
                    "action": "clarify",
                    "question": generated.question,
                    "input_tokens": generated.usage.input_tokens,
                    "output_tokens": generated.usage.output_tokens,
                    "duration_ms": round(generated.duration_ms),
                },
                trace_id=current_trace_id(),
            )
            await _finalize_totals(session, sess, assistant_msg, payload)
            return user_msg, assistant_msg, None
        query_to_run = generated.query
        via_label = f"{provider.provider.value} · {provider.model_id}"
        # Recorded now (not in the ok branch below) so they survive even when the
        # generated query then fails to execute — the translation still cost time,
        # and the rationale is part of the conversation context for later turns.
        assistant_msg.llm_time_ms = round(generated.duration_ms)
        assistant_msg.rationale = generated.rationale or None
        await emit_event(
            session,
            action=actions.LLM_TRANSLATE,
            target_kind=actions.TARGET_SESSION,
            target_id=sess.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={
                "provider": provider.provider.value,
                "model_id": provider.model_id,
                "language": generated.language,
                "generated_query": generated.query,
                "input_tokens": generated.usage.input_tokens,
                "output_tokens": generated.usage.output_tokens,
                "duration_ms": round(generated.duration_ms),
            },
            trace_id=current_trace_id(),
        )

    assistant_msg.source_query = query_to_run
    # Remember the timeout this ask used (LLM + query budget) so the composer can
    # restore it and re-run honours it — applies to both nl and ql.
    assistant_msg.timeout_s = payload.timeout_s

    result: QueryResponse | None = None
    try:
        # HTTPException (config/availability) intentionally bubbles → rollback.
        result = await execute_query(
            session,
            graph=graph,
            manager=manager,
            query=query_to_run,
            parameters=payload.parameters,
            actor_id=actor_id,
            session_id=sess.id,
            timeout_s=payload.timeout_s,
        )
    except QueryExecutionError as exc:
        assistant_msg.status = SessionMessageStatus.error
        # QL: the user wrote the query, so surface the real error to fix it.
        # NL: they wrote a question, not Cypher — show backend-owned guidance and
        # keep the raw error in the audit event / OTel span for review.
        assistant_msg.content = str(exc) if is_ql else _friendly_query_error(exc.category)
    else:
        nodes = len(result.data.nodes) if result.data else 0
        edges = len(result.data.edges) if result.data else 0
        assistant_msg.status = SessionMessageStatus.ok
        assistant_msg.via = via_label or _LANGUAGE_LABEL.get(result.query_language, result.query_language)
        assistant_msg.query_language = result.query_language
        assistant_msg.row_count = result.row_count
        assistant_msg.execution_time_ms = result.execution_time_ms
        assistant_msg.node_count = nodes
        assistant_msg.edge_count = edges
        assistant_msg.content = _summary(result, nodes, edges)
        sess.node_count += nodes
        sess.edge_count += edges

    await _finalize_totals(session, sess, assistant_msg, payload)
    return user_msg, assistant_msg, result


async def rerun_message(
    session: AsyncSession,
    *,
    sess: Session,
    message: SessionMessage,
    graph: Graph,
    manager: GraphConnectionManager,
    actor_id: str,
) -> tuple[SessionMessage, QueryResponse]:
    """Re-execute an assistant message's source_query in place (no new rows).

    Raises ``HTTPException`` (409) if the message has no source_query, or for
    config failures; ``QueryExecutionError`` if the query itself fails (the
    caller maps that to 400).
    """
    if not message.source_query:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail={"error": "no_source_query", "message": "Message has no query to re-run."},
        )

    result = await execute_query(
        session,
        graph=graph,
        manager=manager,
        query=message.source_query,
        parameters=None,
        actor_id=actor_id,
        session_id=sess.id,
        # Honour the timeout the original ask was sent with on re-run.
        timeout_s=message.timeout_s,
    )
    nodes = len(result.data.nodes) if result.data else 0
    edges = len(result.data.edges) if result.data else 0

    # Swap this message's contribution to the session's denormalized totals.
    sess.node_count += nodes - (message.node_count or 0)
    sess.edge_count += edges - (message.edge_count or 0)

    message.status = SessionMessageStatus.ok
    message.query_language = result.query_language
    message.via = _LANGUAGE_LABEL.get(result.query_language, result.query_language)
    message.row_count = result.row_count
    message.execution_time_ms = result.execution_time_ms
    message.node_count = nodes
    message.edge_count = edges
    message.content = _summary(result, nodes, edges)
    # Seqs are contiguous (1..message_count), so the last message has
    # seq == message_count. Re-running it clears any prior failed status on the
    # list; re-running an older message leaves the latest status untouched.
    if message.seq == sess.message_count:
        sess.last_status = message.status
    await session.flush()
    return message, result
