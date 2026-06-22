"""HTTP routes for graph-scoped Query Sessions (RFC-024).

Sessions are the only execution entry point (the standalone `/query` route is
removed). All routes are private to the creator and graph-scoped.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response, status
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
from invana.graphs.query_service import QueryExecutionError
from invana.sessions import services
from invana.sessions.models import Session
from invana.sessions.schemas import (
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
)
from invana.settings import settings

sessions_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/sessions",
    tags=["sessions"],
)


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


async def _to_detail(session: AsyncSession, sess: Session) -> SessionDetail:
    messages = await services.list_messages(session, sess=sess)
    return SessionDetail(
        **SessionSummary.model_validate(sess).model_dump(),
        messages=[SessionMessageRead.model_validate(m) for m in messages],
    )


@sessions_router.get("", response_model=SessionListResponse)
async def list_sessions(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort: Literal["updated", "created"] = Query(default="updated"),
    include_archived: bool = Query(default=False),
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
    )
    return SessionListResponse(items=[SessionSummary.model_validate(s) for s in items], total=total)


@sessions_router.post("", response_model=SessionDetail, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> SessionDetail:
    sess = await services.create_session(session, graph_id=graph.id, user_id=user.id, title=payload.title)
    if payload.message is not None:
        await services.send_message(
            session,
            sess=sess,
            graph=graph,
            manager=manager,
            payload=payload.message,
            actor_id=user.id,
            encryption_key=settings.encryption_key,
        )
    await session.commit()
    await session.refresh(sess)
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


@sessions_router.post("/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(
    payload: SendMessage,
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> SendMessageResponse:
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    user_msg, assistant_msg, result = await services.send_message(
        session,
        sess=sess,
        graph=graph,
        manager=manager,
        payload=payload,
        actor_id=user.id,
        encryption_key=settings.encryption_key,
    )
    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)
    return SendMessageResponse(
        user_message=SessionMessageRead.model_validate(user_msg),
        assistant_message=SessionMessageRead.model_validate(assistant_msg),
        result=result,
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


@sessions_router.post("/{session_id}/messages/{message_id}/run", response_model=RerunResponse)
async def rerun_message(
    session_id: str = Path(...),
    message_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_setup_complete),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    manager: GraphConnectionManager = Depends(_get_manager),
) -> RerunResponse:
    sess = await services.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await services.get_message_or_404(session, message_id=message_id, sess=sess)
    try:
        message, result = await services.rerun_message(
            session, sess=sess, message=message, graph=graph, manager=manager, actor_id=user.id
        )
    except QueryExecutionError as exc:
        await session.commit()  # persist the failure audit event
        # NL re-runs hide the raw driver error behind backend-owned guidance, same
        # as the original ask; QL (and legacy null-mode) re-runs keep the real
        # error so the author can fix their own query. Raw error stays in OTel.
        if message.mode == "nl":
            detail = {
                "error": "query_translation_failed",
                "message": services._friendly_query_error(exc.category),
            }
        else:
            detail = {"error": "query_execution_failed", "message": str(exc)}
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=detail) from exc
    await session.commit()
    await session.refresh(message)
    return RerunResponse(message=SessionMessageRead.model_validate(message), result=result)
