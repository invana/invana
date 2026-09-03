"""HTTP routes for graph-scoped Query Sessions (RFC-024).

Sessions are the only execution entry point (the standalone `/query` route is
removed). All routes are private to the creator and graph-scoped.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.graphs.deps import (
    require_graph_member,
    require_graph_setup_complete,
    resolve_graph_by_username_slug,
)
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph, GraphMember
from invana.sessions import services
from invana.sessions.models import Session
from invana.sessions.schemas import (
    OperationResponse,
    RecordOperation,
    RerunResponse,
    SendMessage,
    SendMessageResponse,
    SessionContextTurn,
    SessionCreate,
    SessionDetail,
    SessionListResponse,
    SessionMessageRead,
    SessionSummary,
    SessionUpdate,
    SetFeedback,
    ThinkingStepRead,
)
from invana.thinking import services as thinking_services
from invana.thinking.routes import get_runtime
from invana.thinking.runtime import ThinkingRuntime

sessions_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/sessions",
    tags=["sessions"],
)


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


async def _to_detail(session: AsyncSession, sess: Session) -> SessionDetail:
    messages = await services.list_messages(session, sess=sess)
    # Each reply carries its task trace (RFC-055) — the steps of its current
    # thinking, so a settled thread renders without a stream.
    steps = await thinking_services.steps_for_messages(session, messages)
    return SessionDetail(
        **SessionSummary.model_validate(sess).model_dump(),
        messages=[
            SessionMessageRead.model_validate(m).model_copy(
                update={"steps": [ThinkingStepRead.model_validate(r) for r in steps.get(m.id, [])]}
            )
            for m in messages
        ],
    )


@sessions_router.get("", response_model=SessionListResponse)
async def list_sessions(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: Literal["updated", "created"] = Query(default="updated"),
    include_archived: bool = Query(default=False),
    surface: Literal["explorer", "modeller"] | None = Query(default=None),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionListResponse:
    items, total = await services.list_sessions(
        session,
        graph_id=graph.id,
        user_id=user.id,
        limit=limit,
        offset=offset,
        sort=sort,
        include_archived=include_archived,
        surface=surface,
    )
    return SessionListResponse(items=[SessionSummary.model_validate(s) for s in items], total=total)


@sessions_router.post("", response_model=SessionDetail, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: ThinkingRuntime = Depends(get_runtime),
) -> SessionDetail:
    sess = await services.create_session(
        session,
        graph_id=graph.id,
        user_id=user.id,
        title=payload.title,
        surface=payload.surface,
        model_id=payload.model_id,
    )
    thinking_id: str | None = None
    if payload.message is not None:
        _, _, th = await thinking_services.open_turn(
            session, sess=sess, graph=graph, payload=payload.message, actor_id=user.id
        )
        thinking_id = th.id
    await session.commit()
    await session.refresh(sess)
    if thinking_id is not None:
        runtime.submit(thinking_id)
    return await _to_detail(session, sess)


@sessions_router.get("/{session_id}", response_model=SessionDetail)
async def get_session_detail(
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionDetail:
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    return await _to_detail(session, sess)


@sessions_router.patch("/{session_id}", response_model=SessionSummary)
async def update_session(
    payload: SessionUpdate,
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionSummary:
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    await services.update_session(
        session,
        sess=sess,
        title=payload.title,
        pinned=payload.pinned,
        archived=payload.archived,
    )
    await session.commit()
    await session.refresh(sess)
    return SessionSummary.model_validate(sess)


@sessions_router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    await services.delete_session(session, sess=sess, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@sessions_router.post(
    "/{session_id}/messages", response_model=SendMessageResponse, status_code=status.HTTP_202_ACCEPTED
)
async def send_message(
    payload: SendMessage,
    session_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: ThinkingRuntime = Depends(get_runtime),
) -> SendMessageResponse:
    """Record the ask and start thinking (RFC-055). Returns as soon as the rows
    are committed; the reply settles over ``stream_url``. When the session's
    newest reply is a clarifying question, the text **answers it** — the same
    thinking resumes instead of a new one opening (UC7 "let me type")."""
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    waiting = await thinking_services.awaiting_thinking(session, sess=sess)
    if waiting is not None:
        user_msg, assistant_msg = await thinking_services.resume_turn(
            session, sess=sess, thinking=waiting, answer=payload.content
        )
        th = waiting
    else:
        user_msg, assistant_msg, th = await thinking_services.open_turn(
            session, sess=sess, graph=graph, payload=payload, actor_id=user.id
        )
    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)
    runtime.submit(th.id)
    return SendMessageResponse(
        user_message=SessionMessageRead.model_validate(user_msg),
        assistant_message=SessionMessageRead.model_validate(assistant_msg),
        result=None,
        thinking_id=th.id,
        stream_url=thinking_services.stream_url(username, graphSlug, th.id),
    )


@sessions_router.post("/{session_id}/operations", response_model=OperationResponse)
async def record_operation(
    payload: RecordOperation,
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OperationResponse:
    """Log a client-driven canvas operation (currently "Load to canvas") as a
    session turn (RFC-046). No query runs — the client supplies the referenced
    query + counts. Read-only w.r.t. the graph, so no connection is needed."""
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    user_msg, assistant_msg = await services.record_load(session, sess=sess, payload=payload)
    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)
    return OperationResponse(
        user_message=SessionMessageRead.model_validate(user_msg),
        assistant_message=SessionMessageRead.model_validate(assistant_msg),
    )


@sessions_router.get(
    "/{session_id}/messages/{message_id}/context",
    response_model=list[SessionContextTurn],
)
async def message_context(
    session_id: str = Path(...),
    message_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SessionContextTurn]:
    """The conversation context (RFC-036) that was sent for this assistant reply.

    Recomputed from the prior turns (RFC-040) — empty for a first turn or a
    non-nl reply. Read-only; no graph connection needed.
    """
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await services.get_message_or_404(session, message_id=message_id, sess=sess)
    turns = await services.get_message_context(session, message=message)
    return [SessionContextTurn(**t) for t in turns]


@sessions_router.post(
    "/{session_id}/messages/{message_id}/feedback",
    response_model=SessionMessageRead,
)
async def set_message_feedback(
    payload: SetFeedback,
    session_id: str = Path(...),
    message_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionMessageRead:
    """Record (or clear) a 👍/👎 vote on an assistant reply (RFC-038/039)."""
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await services.get_message_or_404(session, message_id=message_id, sess=sess)
    message = await services.set_feedback(session, message=message, value=payload.value)
    await session.commit()
    await session.refresh(message)
    return SessionMessageRead.model_validate(message)


@sessions_router.post(
    "/{session_id}/messages/{message_id}/run", response_model=RerunResponse, status_code=status.HTTP_202_ACCEPTED
)
async def rerun_message(
    session_id: str = Path(...),
    message_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: ThinkingRuntime = Depends(get_runtime),
) -> RerunResponse:
    """Re-run a reply's query in place: a new thinking on the same thought (RFC-048 rethink).
    The reply's step list is replaced by the new run's; the result rides its stream."""
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await services.get_message_or_404(session, message_id=message_id, sess=sess)
    th = await thinking_services.rerun_turn(session, sess=sess, graph=graph, message=message, actor_id=user.id)
    await session.commit()
    await session.refresh(message)
    runtime.submit(th.id)
    return RerunResponse(
        message=SessionMessageRead.model_validate(message),
        result=None,
        thinking_id=th.id,
        stream_url=thinking_services.stream_url(username, graphSlug, th.id),
    )
