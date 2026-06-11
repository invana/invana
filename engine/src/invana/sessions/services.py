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
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph
from invana.graphs.query_service import QueryExecutionError, execute_query
from invana.graphs.schemas import QueryResponse
from invana.sessions.models import (
    Session,
    SessionMessage,
    SessionMessageRole,
    SessionMessageStatus,
)
from invana.sessions.schemas import SendMessage
from invana.sessions.store import SessionStore

_LANGUAGE_LABEL = {"cypher": "Cypher", "gremlin": "Gremlin"}
_NL_NOT_WIRED = "Natural-language queries aren't wired to the engine yet — switch to Query Language to run one."


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


# ── Reads ─────────────────────────────────────────────────────────────────────


async def list_sessions(
    session: AsyncSession,
    *,
    graph_id: str,
    user_id: str,
    limit: int,
    offset: int,
) -> tuple[list[Session], int]:
    store = SessionStore()
    items = await store.list_for_user(session, graph_id=graph_id, user_id=user_id, limit=limit, offset=offset)
    total = await store.count_for_user(session, graph_id=graph_id, user_id=user_id)
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


async def send_message(
    session: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    manager: GraphConnectionManager,
    payload: SendMessage,
    actor_id: str,
) -> tuple[SessionMessage, SessionMessage, QueryResponse | None]:
    """Append a user message + assistant reply, running the query for `ql` mode.

    Query *config* failures (no connection / not active / read-only) raise
    ``HTTPException`` — the caller does not commit, so nothing persists. A query
    *execution* failure is recorded as an error assistant message (committed).
    """
    store = SessionStore()
    is_ql = payload.mode == "ql"

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
        content="Running query…" if is_ql else _NL_NOT_WIRED,
        status=SessionMessageStatus.running if is_ql else SessionMessageStatus.ok,
        via=None if is_ql else "Assistant",
        source_query=payload.content if is_ql else None,
    )
    await store.add(session, user_msg)
    await store.add(session, assistant_msg)

    result: QueryResponse | None = None
    if is_ql:
        try:
            # HTTPException (config/availability) intentionally bubbles → rollback.
            result = await execute_query(
                session,
                graph=graph,
                manager=manager,
                query=payload.content,
                parameters=payload.parameters,
                actor_id=actor_id,
                session_id=sess.id,
            )
        except QueryExecutionError as exc:
            assistant_msg.status = SessionMessageStatus.error
            assistant_msg.content = str(exc)
        else:
            nodes = len(result.data.nodes) if result.data else 0
            edges = len(result.data.edges) if result.data else 0
            assistant_msg.status = SessionMessageStatus.ok
            assistant_msg.via = _LANGUAGE_LABEL.get(result.query_language, result.query_language)
            assistant_msg.query_language = result.query_language
            assistant_msg.row_count = result.row_count
            assistant_msg.execution_time_ms = result.execution_time_ms
            assistant_msg.node_count = nodes
            assistant_msg.edge_count = edges
            assistant_msg.content = _summary(result, nodes, edges)
            sess.node_count += nodes
            sess.edge_count += edges

    sess.message_count += 2
    if not sess.title:
        sess.title = _title_from_text(payload.content)
    await session.flush()
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
    await session.flush()
    return message, result
