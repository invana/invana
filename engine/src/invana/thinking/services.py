"""Opening, resuming, re-running and reading thinkings (RFC-055 § 9.3).

These write the rows a run needs **before** the runtime starts (the route
commits, then submits), so a subscriber that connects immediately sees the plan
— the queued step rows — from the record. Nothing here executes a task.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.graphs.models import Graph
from invana.sessions.models import Session, SessionMessage, SessionMessageRole, SessionMessageStatus, SessionSurface
from invana.sessions.schemas import SendMessage
from invana.sessions.services import _resolve_provider, _title_from_text
from invana.sessions.store import SessionStore
from invana.settings import settings
from invana.thinking.models import StepStatus, Thinking, ThinkingStatus, ThinkingStep, Thought
from invana.thinking.workflows import MODELLER_GENERATE, NL_QUERY, QL_QUERY, WORKFLOWS, Workflow


def stream_url(username: str, graph_slug: str, thinking_id: str) -> str:
    return f"/api/v1/u/{username}/{graph_slug}/thinkings/{thinking_id}/stream"


def _queue_steps(db: AsyncSession, th: Thinking, message_id: str, wf: Workflow, *, start: int = 0) -> None:
    for i in range(start, len(wf.steps)):
        step = wf.steps[i]
        db.add(
            ThinkingStep(
                thinking_id=th.id,
                message_id=message_id,
                seq=i,
                task_key=step.task_key,
                label=step.label,
                attempt=1,
                status=StepStatus.queued.value,
            )
        )


async def _next_attempt(db: AsyncSession, thinking_id: str, seq: int) -> int:
    prior = (
        (
            await db.execute(
                select(ThinkingStep.attempt)
                .where(ThinkingStep.thinking_id == thinking_id, ThinkingStep.seq == seq)
                .order_by(ThinkingStep.attempt.desc())
            )
        )
        .scalars()
        .first()
    )
    return (prior or 0) + 1


async def _prune(db: AsyncSession, graph_id: str) -> None:
    """Keep the newest ``INVANA_THINKING_HISTORY_LIMIT`` thinkings per graph (RFC-048 D11)."""
    limit = settings.thinking_history_limit
    if limit <= 0:
        return
    keep = select(Thinking.id).where(Thinking.graph_id == graph_id).order_by(Thinking.queued_at.desc()).limit(limit)
    await db.execute(delete(Thinking).where(Thinking.graph_id == graph_id, Thinking.id.not_in(keep)))


async def open_turn(
    db: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    payload: SendMessage,
    actor_id: str,
) -> tuple[SessionMessage, SessionMessage, Thinking]:
    """Record the ask: user + assistant rows, the Thought, a queued Thinking and its step rows.

    Config failures (no provider, query mode on a modeller session) raise before
    anything is written, exactly as the synchronous path did.
    """
    is_modeller = sess.surface == SessionSurface.modeller
    if is_modeller and payload.mode == "ql":
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail="Modeller sessions author a model — query mode isn't available here.",
        )
    needs_provider = is_modeller or payload.mode == "nl"
    provider = (
        await _resolve_provider(db, graph_id=graph.id, llm_provider_id=payload.llm_provider_id)
        if needs_provider
        else None
    )
    wf = MODELLER_GENERATE if is_modeller else (NL_QUERY if payload.mode == "nl" else QL_QUERY)

    store = SessionStore()
    user_seq = await store.next_seq(db, session_id=sess.id)
    user_msg = SessionMessage(session_id=sess.id, seq=user_seq, role=SessionMessageRole.user, content=payload.content)
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content="Generating model…" if is_modeller else "Running query…",
        status=SessionMessageStatus.running,
        mode="nl" if is_modeller else payload.mode,
        timeout_s=payload.timeout_s,
    )
    await store.add(db, user_msg)
    await store.add(db, assistant_msg)

    thought = Thought(
        graph_id=graph.id,
        session_id=sess.id,
        message_id=user_msg.id,
        author_id=actor_id,
        kind="nl" if is_modeller else payload.mode,
        body=payload.content,
        params={
            "language": payload.language.value if payload.language else None,
            "llm_provider_id": provider.id if provider else None,
            "timeout_s": payload.timeout_s,
            "parameters": payload.parameters,
        },
    )
    db.add(thought)
    await db.flush()
    th = Thinking(thought_id=thought.id, graph_id=graph.id, workflow_key=wf.key, assistant_message_id=assistant_msg.id)
    db.add(th)
    await db.flush()
    assistant_msg.thinking_id = th.id
    _queue_steps(db, th, assistant_msg.id, wf)

    sess.message_count += 2
    sess.last_status = assistant_msg.status
    if not sess.title:
        sess.title = _title_from_text(payload.content)
    await _prune(db, graph.id)
    await db.flush()
    return user_msg, assistant_msg, th


async def resume_turn(
    db: AsyncSession,
    *,
    sess: Session,
    thinking: Thinking,
    answer: str,
) -> tuple[SessionMessage, SessionMessage]:
    """Answer a clarification: the same thinking continues from its cursor under a new reply row (UC7)."""
    if thinking.status != ThinkingStatus.awaiting_input.value:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail={"error": "not_awaiting_input", "message": "This thinking isn't waiting for an answer."},
        )
    wf = _workflow(thinking)
    start = int((thinking.cursor or {}).get("step", 0))
    store = SessionStore()
    user_seq = await store.next_seq(db, session_id=sess.id)
    user_msg = SessionMessage(session_id=sess.id, seq=user_seq, role=SessionMessageRole.user, content=answer)
    prev = await db.get(SessionMessage, thinking.assistant_message_id) if thinking.assistant_message_id else None
    assistant_msg = SessionMessage(
        session_id=sess.id,
        seq=user_seq + 1,
        role=SessionMessageRole.assistant,
        content="Generating model…" if wf.key == MODELLER_GENERATE.key else "Running query…",
        status=SessionMessageStatus.running,
        mode="nl",
        timeout_s=prev.timeout_s if prev else None,
        thinking_id=thinking.id,
    )
    await store.add(db, user_msg)
    await store.add(db, assistant_msg)
    thinking.assistant_message_id = assistant_msg.id
    thinking.status = ThinkingStatus.queued.value
    thinking.finished_at = None
    for i in range(start, len(wf.steps)):
        step = wf.steps[i]
        db.add(
            ThinkingStep(
                thinking_id=thinking.id,
                message_id=assistant_msg.id,
                seq=i,
                task_key=step.task_key,
                label=step.label,
                attempt=await _next_attempt(db, thinking.id, i),
                status=StepStatus.queued.value,
            )
        )
    sess.message_count += 2
    sess.last_status = assistant_msg.status
    await db.flush()
    return user_msg, assistant_msg


async def rerun_turn(
    db: AsyncSession,
    *,
    sess: Session,
    graph: Graph,
    message: SessionMessage,
    actor_id: str,
) -> Thinking:
    """Re-run a reply's query in place: a new ``ql-query`` thinking on the same thought, writing the same row."""
    if not message.source_query:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT,
            detail={"error": "no_source_query", "message": "Message has no query to re-run."},
        )
    thought_id: str | None = None
    if message.thinking_id:
        prev = await db.get(Thinking, message.thinking_id)
        thought_id = prev.thought_id if prev else None
    if thought_id is None:
        # A reply from before the runtime existed — give it a thought so the rerun is on the record.
        thought = Thought(
            graph_id=graph.id,
            session_id=sess.id,
            message_id=None,
            author_id=actor_id,
            kind="ql",
            body=message.source_query,
            params={"language": message.query_language, "timeout_s": message.timeout_s},
        )
        db.add(thought)
        await db.flush()
        thought_id = thought.id
    th = Thinking(thought_id=thought_id, graph_id=graph.id, workflow_key=QL_QUERY.key, assistant_message_id=message.id)
    db.add(th)
    await db.flush()
    # The runtime reads the ask from the user row before the reply; a re-run
    # asks the stored query, so pin it on the thought params the loop reads.
    message.thinking_id = th.id
    message.status = SessionMessageStatus.running
    # Swap this message's contribution to the session's totals back out; the run adds the new counts.
    sess.node_count -= message.node_count or 0
    sess.edge_count -= message.edge_count or 0
    message.node_count = None
    message.edge_count = None
    _queue_steps(db, th, message.id, QL_QUERY)
    if message.seq == sess.message_count:
        sess.last_status = message.status
    await db.flush()
    return th


def _workflow(th: Thinking) -> Workflow:
    return WORKFLOWS[th.workflow_key]


async def awaiting_thinking(db: AsyncSession, *, sess: Session) -> Thinking | None:
    """The session's newest reply's thinking, when it is waiting for an answer."""
    last = (
        await db.execute(
            select(SessionMessage)
            .where(SessionMessage.session_id == sess.id, SessionMessage.role == SessionMessageRole.assistant)
            .order_by(SessionMessage.seq.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if last is None or not last.thinking_id:
        return None
    th = await db.get(Thinking, last.thinking_id)
    if th is not None and th.status == ThinkingStatus.awaiting_input.value:
        return th
    return None


async def get_thinking_or_404(db: AsyncSession, *, thinking_id: str, graph_id: str, user_id: str) -> Thinking:
    th = await db.get(Thinking, thinking_id)
    if th is None or th.graph_id != graph_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Thinking not found.")
    thought = await db.get(Thought, th.thought_id)
    sess = await db.get(Session, thought.session_id) if thought and thought.session_id else None
    # Thinkings are as private as the session they belong to.
    if sess is not None and sess.created_by_id != user_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Thinking not found.")
    return th


async def list_steps(db: AsyncSession, *, thinking_id: str) -> list[ThinkingStep]:
    return list(
        (
            await db.execute(
                select(ThinkingStep)
                .where(ThinkingStep.thinking_id == thinking_id)
                .order_by(ThinkingStep.seq, ThinkingStep.attempt)
            )
        ).scalars()
    )


async def steps_for_messages(db: AsyncSession, messages: list[SessionMessage]) -> dict[str, list[ThinkingStep]]:
    """Each reply's steps — from its **current** thinking only (a re-run replaces the list)."""
    wanted = {m.id: m.thinking_id for m in messages if m.thinking_id}
    if not wanted:
        return {}
    rows = (
        await db.execute(
            select(ThinkingStep)
            .where(ThinkingStep.message_id.in_(list(wanted)))
            .order_by(ThinkingStep.seq, ThinkingStep.attempt)
        )
    ).scalars()
    out: dict[str, list[ThinkingStep]] = {}
    for r in rows:
        if r.message_id and wanted.get(r.message_id) == r.thinking_id:
            out.setdefault(r.message_id, []).append(r)
    return out


async def cancel_waiting(db: AsyncSession, *, thinking: Thinking) -> None:
    """Cancel a thinking that is parked on a clarification (nothing is running)."""
    thinking.status = ThinkingStatus.cancelled.value
    for row in await list_steps(db, thinking_id=thinking.id):
        if row.status in {StepStatus.queued.value, StepStatus.needs_input.value}:
            row.status = StepStatus.stopped.value
    await db.flush()
