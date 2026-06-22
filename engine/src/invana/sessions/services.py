"""Service layer for Query Sessions (RFC-024).

Owns session/message persistence and orchestrates query execution via the
shared ``execute_query`` service. Sessions are private to their creator and
graph-scoped; ``get_or_404`` enforces both.
"""

from __future__ import annotations

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
from invana.llm.translate import nl_to_query
from invana.llm_providers.models import LLMProvider
from invana.llm_providers.store import LLMProviderStore
from invana.modeller.models import GraphVersion
from invana.modeller.store import ModelStore
from invana.sessions.models import (
    Session,
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
)
from invana.sessions.schemas import SendMessage
from invana.sessions.store import SessionStore

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
        if m.role == SessionMessageRole.user:
            pending_user = m.content
        elif (
            m.role == SessionMessageRole.assistant
            and m.status == SessionMessageStatus.ok
            and m.source_query
            and pending_user is not None
        ):
            turns.append({"prompt": pending_user, "query": m.source_query, "rationale": m.rationale or ""})
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
        content = f"{t['query']}\n-- {t['rationale']}" if t["rationale"] else t["query"]
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
    )
    total = await store.count_for_user(session, graph_id=graph_id, user_id=user_id, include_archived=include_archived)
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
) -> Session:
    sess = Session(graph_id=graph_id, created_by_id=user_id, title=title or "")
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

    ``ql`` runs the content directly; ``nl`` translates it to a grounded
    read-only query first (RFC-030) and runs that. *Config* failures (no
    provider / no connection / read-only) raise ``HTTPException`` so the caller
    rolls back and nothing persists; *translation* and *execution* failures are
    recorded as an error assistant message (committed).
    """
    store = SessionStore()
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
