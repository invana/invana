"""HTTP views for Ask sessions.

Parse, call one manager, serialise (migration-plan §4.1). Sessions are private
to their creator, which the manager enforces — the views only pass the caller
through.
"""

from __future__ import annotations

from typing import Literal

from fastapi import Depends, Path, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import Session
from invana.apps.sessions.schemas import (
    OperationResponse,
    RecordOperation,
    RerunResponse,
    RunNodeRead,
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
)
from invana.core.auth.deps import get_current_user
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.runtime import services as run_services
from invana.runtime.interpreter import TaskRuntime
from invana.server.graphs.deps import (
    require_graph_answering,
    require_graph_member,
    resolve_graph_by_username_slug,
)
from invana.server.runtime.runs import get_runtime

sessions = SessionManager()


def _get_manager(request: Request) -> GraphConnectionManager:
    return request.app.state.graph_connection_manager


async def _summary(session: AsyncSession, sess: Session) -> SessionSummary:
    """The list/header row, with the agent resolved.

    ``agent_status`` is what lets the composer block on a paused or retired
    agent and offer the picker, rather than answering with a different mind.
    """
    summary = SessionSummary.model_validate(sess)
    if sess.agent_id:
        agent = await session.get(Agent, sess.agent_id)
        if agent is not None:
            summary.agent_name = agent.name
            summary.agent_status = agent.status
    return summary


async def _summaries(session: AsyncSession, items: list[Session]) -> list[SessionSummary]:
    ids = {s.agent_id for s in items if s.agent_id}
    agents = (
        {a.id: a for a in (await session.execute(select(Agent).where(Agent.id.in_(list(ids))))).scalars().all()}
        if ids
        else {}
    )
    out: list[SessionSummary] = []
    for sess in items:
        summary = SessionSummary.model_validate(sess)
        agent = agents.get(sess.agent_id or "")
        if agent is not None:
            summary.agent_name = agent.name
            summary.agent_status = agent.status
        out.append(summary)
    return out


async def _to_detail(session: AsyncSession, sess: Session) -> SessionDetail:
    messages = await sessions.list_messages(session, sess=sess)
    # Each reply carries its task trace (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) — the
    # steps of its current
    # run, so a settled thread renders without a stream.
    steps = await run_services.steps_for_messages(session, messages)
    return SessionDetail(
        **(await _summary(session, sess)).model_dump(),
        messages=[
            SessionMessageRead.model_validate(m).model_copy(
                update={"steps": [RunNodeRead.model_validate(r) for r in steps.get(m.id, [])]}
            )
            for m in messages
        ],
    )


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
    items, total = await sessions.list_sessions(
        session,
        graph_id=graph.id,
        user_id=user.id,
        limit=limit,
        offset=offset,
        sort=sort,
        include_archived=include_archived,
        surface=surface,
    )
    return SessionListResponse(items=await _summaries(session, items), total=total)


async def create_session(
    payload: SessionCreate,
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_answering),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(get_runtime),
) -> SessionDetail:
    sess = await sessions.create_session(
        session,
        graph=graph,
        user_id=user.id,
        title=payload.title,
        surface=payload.surface,
        model_id=payload.model_id,
        agent_id=payload.agent_id,
    )
    run_id: str | None = None
    if payload.message is not None:
        _, _, th = await run_services.open_turn(
            session, sess=sess, graph=graph, payload=payload.message, actor_id=user.id
        )
        run_id = th.id
    await session.commit()
    await session.refresh(sess)
    if run_id is not None:
        runtime.submit(run_id)
    return await _to_detail(session, sess)


async def get_session_detail(
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionDetail:
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    return await _to_detail(session, sess)


async def update_session(
    payload: SessionUpdate,
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionSummary:
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    await sessions.update_session(
        session,
        sess=sess,
        title=payload.title,
        pinned=payload.pinned,
        archived=payload.archived,
        agent_id=payload.agent_id,
        actor_id=user.id,
    )
    await session.commit()
    await session.refresh(sess)
    return await _summary(session, sess)


async def delete_session(
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    await sessions.delete_session(session, sess=sess, actor_id=user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def send_message(
    payload: SendMessage,
    session_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_answering),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(get_runtime),
) -> SendMessageResponse:
    """Record the ask and start run (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).
    Returns as soon as the rows
    are committed; the reply settles over ``stream_url``. When the session's
    newest reply is a clarifying question, the text **answers it** — the same
    run resumes instead of a new one opening (UC7 "let me type")."""
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    waiting = await run_services.awaiting_run(session, sess=sess)
    if waiting is not None:
        user_msg, assistant_msg = await run_services.resume_turn(
            session, sess=sess, run=waiting, answer=payload.content
        )
        th = waiting
    else:
        user_msg, assistant_msg, th = await run_services.open_turn(
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
        run_id=th.id,
        stream_url=run_services.stream_url(username, graphSlug, th.id),
    )


async def record_operation(
    payload: RecordOperation,
    session_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OperationResponse:
    """Log a client-driven canvas operation (currently "Load to canvas") as a
    session turn (docs/for-developers/modules/explore/features/boards.md). No query runs — the client supplies the
    referenced
    query + counts. Read-only w.r.t. the graph, so no connection is needed."""
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    user_msg, assistant_msg = await sessions.record_load(session, sess=sess, payload=payload)
    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)
    return OperationResponse(
        user_message=SessionMessageRead.model_validate(user_msg),
        assistant_message=SessionMessageRead.model_validate(assistant_msg),
    )


async def message_context(
    session_id: str = Path(...),
    message_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SessionContextTurn]:
    """The conversation context (docs/for-developers/modules/ask/spec.md) that was sent for this assistant reply.

    Recomputed from the prior turns (docs/for-developers/modules/ask/features/reasoning-trace.md) — empty for a first
    turn or a
    non-nl reply. Read-only; no graph connection needed.
    """
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await sessions.get_message_or_404(session, message_id=message_id, sess=sess)
    turns = await sessions.get_message_context(session, message=message)
    return [SessionContextTurn(**t) for t in turns]


async def set_message_feedback(
    payload: SetFeedback,
    session_id: str = Path(...),
    message_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionMessageRead:
    """Record (or clear) a 👍/👎 vote on an assistant reply
    (docs/for-developers/modules/ask/features/clarifying-questions.md ·
    docs/for-developers/modules/workflows/features/promote-a-plan.md)."""
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await sessions.get_message_or_404(session, message_id=message_id, sess=sess)
    message = await sessions.set_feedback(session, message=message, value=payload.value)
    await session.commit()
    await session.refresh(message)
    return SessionMessageRead.model_validate(message)


async def rerun_message(
    session_id: str = Path(...),
    message_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(require_graph_answering),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: TaskRuntime = Depends(get_runtime),
) -> RerunResponse:
    """Re-run a reply's query in place: a new run on the same run_ask (docs/for-developers/modules/ask/spec.md
    rethink).
    The reply's step list is replaced by the new run's; the result rides its stream."""
    sess = await sessions.get_or_404(session, session_id=session_id, graph_id=graph.id, user_id=user.id)
    message = await sessions.get_message_or_404(session, message_id=message_id, sess=sess)
    th = await run_services.rerun_turn(session, sess=sess, graph=graph, message=message, actor_id=user.id)
    await session.commit()
    await session.refresh(message)
    runtime.submit(th.id)
    return RerunResponse(
        message=SessionMessageRead.model_validate(message),
        result=None,
        run_id=th.id,
        stream_url=run_services.stream_url(username, graphSlug, th.id),
    )
