"""HTTP routes for thinkings (RFC-055 § 9.3): read, tail, resume, cancel.

Opening a thinking happens through the sessions routes (a message *is* the ask);
these address the run in its own right.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Path, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from invana.auth.deps import get_current_user
from invana.auth.models import User
from invana.db import get_session
from invana.graphs.deps import require_graph_member, resolve_graph_by_username_slug
from invana.graphs.models import Graph, GraphMember
from invana.sessions.schemas import SendMessageResponse, SessionMessageRead
from invana.thinking import services
from invana.thinking.models import ThinkingStatus, Thought
from invana.thinking.runtime import ThinkingRuntime
from invana.thinking.schemas import CancelResponse, ResumeThinking, ThinkingRead, ThinkingStepRead
from invana.thinking.stream import subscribe

thinkings_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/thinkings", tags=["thinkings"])


def get_runtime(request: Request) -> ThinkingRuntime:
    return request.app.state.thinking_runtime


def _sse(generator) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@thinkings_router.get("/{thinking_id}", response_model=ThinkingRead)
async def get_thinking(
    thinking_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ThinkingRead:
    th = await services.get_thinking_or_404(session, thinking_id=thinking_id, graph_id=graph.id, user_id=user.id)
    steps = await services.list_steps(session, thinking_id=th.id)
    return ThinkingRead(
        **ThinkingRead.model_validate(th).model_dump(exclude={"steps"}),
        steps=[ThinkingStepRead.model_validate(s) for s in steps],
    )


@thinkings_router.get("/{thinking_id}/stream")
async def stream_thinking(
    request: Request,
    thinking_id: str = Path(...),
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE tail of a thinking's stream: replay after the cursor, then live.

    ``Last-Event-ID`` (set by the browser on reconnect) wins over ``after``.
    The request-scoped DB session is released before the generator starts —
    the tail opens its own for the replay.
    """
    await services.get_thinking_or_404(session, thinking_id=thinking_id, graph_id=graph.id, user_id=user.id)
    if last_event_id and last_event_id.isdigit():
        after = int(last_event_id)
    factory = request.app.state.db_session_factory
    return _sse(subscribe(factory, thinking_id=thinking_id, after=after))


@thinkings_router.post(
    "/{thinking_id}/resume", response_model=SendMessageResponse, status_code=status.HTTP_202_ACCEPTED
)
async def resume_thinking(
    payload: ResumeThinking,
    thinking_id: str = Path(...),
    username: str = Path(...),
    graphSlug: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: ThinkingRuntime = Depends(get_runtime),
) -> SendMessageResponse:
    """Answer a clarification — the same thinking continues (UC7)."""
    from invana.sessions import services as session_services  # noqa: PLC0415 — sessions ↔ thinking import cycle

    th = await services.get_thinking_or_404(session, thinking_id=thinking_id, graph_id=graph.id, user_id=user.id)
    thought = await session.get(Thought, th.thought_id)
    sess = await session_services.get_or_404(session, session_id=thought.session_id, graph_id=graph.id, user_id=user.id)
    user_msg, assistant_msg = await services.resume_turn(session, sess=sess, thinking=th, answer=payload.answer)
    await session.commit()
    await session.refresh(user_msg)
    await session.refresh(assistant_msg)
    runtime.submit(th.id)
    return SendMessageResponse(
        user_message=SessionMessageRead.model_validate(user_msg),
        assistant_message=SessionMessageRead.model_validate(assistant_msg),
        result=None,
        thinking_id=th.id,
        stream_url=services.stream_url(username, graphSlug, th.id),
    )


@thinkings_router.post("/{thinking_id}/cancel", response_model=CancelResponse, status_code=status.HTTP_202_ACCEPTED)
async def cancel_thinking(
    thinking_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    runtime: ThinkingRuntime = Depends(get_runtime),
) -> CancelResponse:
    """Stop thinking (UC9). A run in flight is cancelled; one parked on a question is closed."""
    th = await services.get_thinking_or_404(session, thinking_id=thinking_id, graph_id=graph.id, user_id=user.id)
    if th.status == ThinkingStatus.awaiting_input.value:
        await services.cancel_waiting(session, thinking=th)
        await session.commit()
        return CancelResponse(id=th.id, status=th.status)
    if th.status in {ThinkingStatus.queued.value, ThinkingStatus.thinking.value}:
        await runtime.cancel(th.id)
        await session.refresh(th)
    return CancelResponse(id=th.id, status=th.status)
