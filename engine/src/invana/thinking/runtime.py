"""The inline runtime — one ``asyncio`` task per thinking (RFC-048 ``inline`` adapter).

``ThinkingRuntime`` owns the interpreter loop of RFC-055 § 9.2: for each step of
the workflow, mark the row running, run the task, and settle the row as
succeeded / failed / needs_input / stopped — retrying on the classes the step's
policy allows (RFC-052 § 3), emitting a ``diagnosis`` on a terminal failure and
writing the assistant reply exactly as the synchronous path used to when the
run ends. It holds **one** DB session for the run (like the request it
replaces) and commits at every step boundary so subscribers replaying from the
record see the same transitions a live tail did.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import random
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.events import actions
from invana.events.models import ActorType
from invana.events.services import emit_event
from invana.graphs.manager import GraphConnectionManager
from invana.graphs.models import Graph
from invana.llm_providers.store import LLMProviderStore
from invana.sessions.models import Session, SessionMessage, SessionMessageStatus, SessionSurface
from invana.sessions.services import _friendly_query_error, _model_summary, _title_from_text
from invana.sessions.store import SessionStore
from invana.telemetry.recorders import add_message_in_flight, record_session_message
from invana.thinking.diagnosis import diagnose, internal_failure
from invana.thinking.models import StepStatus, Thinking, ThinkingStatus, ThinkingStep, Thought
from invana.thinking.stream import Emitter, broadcaster
from invana.thinking.tasks import (
    TASKS,
    NeedsInput,
    RunVars,
    TaskContext,
    TaskFailure,
    assemble_history,
    load_grounding,
)
from invana.thinking.workflows import WORKFLOWS, Step

log = logging.getLogger(__name__)

# Prior turns replayed as NL context (RFC-036) — same window as the old path.
_HISTORY_TURNS = 6


def _now() -> datetime:
    return datetime.now(UTC)


def _ms(start: datetime | None, end: datetime | None) -> int | None:
    if start is None or end is None:
        return None
    return round((end - start).total_seconds() * 1000)


def _step_payload(row: ThinkingStep) -> dict:
    return {
        "step_id": row.id,
        "message_id": row.message_id,
        "seq": row.seq,
        "task_key": row.task_key,
        "label": row.label,
        "attempt": row.attempt,
        "status": row.status,
        "detail": row.detail,
        "started_at": row.started_at,
        "finished_at": row.finished_at,
        "duration_ms": _ms(row.started_at, row.finished_at),
        "input": row.input,
        "output": row.output,
        "error": row.error,
        "tokens_in": row.tokens_in,
        "tokens_out": row.tokens_out,
    }


def message_payload(m: SessionMessage) -> dict:
    """The finalized assistant row, as the stream carries it (mirrors SessionMessageRead)."""
    return {
        "id": m.id,
        "session_id": m.session_id,
        "seq": m.seq,
        "role": m.role.value,
        "content": m.content,
        "status": m.status.value if m.status else None,
        "operation": m.operation,
        "mode": m.mode,
        "via": m.via,
        "query_language": m.query_language,
        "source_query": m.source_query,
        "clarification_options": m.clarification_options,
        "feedback": m.feedback,
        "row_count": m.row_count,
        "execution_time_ms": m.execution_time_ms,
        "llm_time_ms": m.llm_time_ms,
        "timeout_s": m.timeout_s,
        "node_count": m.node_count,
        "edge_count": m.edge_count,
        "thinking_id": m.thinking_id,
        "created_at": m.created_at,
    }


class ThinkingRuntime:
    """Runs thinkings in-process. Created in the app lifespan; stubbed in route tests."""

    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        manager: GraphConnectionManager,
        encryption_key: str,
    ) -> None:
        self._factory = session_factory
        self._manager = manager
        self._key = encryption_key
        self._tasks: dict[str, asyncio.Task] = {}

    # ── lifecycle ─────────────────────────────────────────────────────────────

    async def startup(self) -> None:
        """Fail whatever was mid-flight when the process died — nothing streams forever.

        A database that hasn't had migration 28 applied yet has no ``thinkings``
        table; that must not take the whole API down, so the sweep logs the fix
        (``invana migrate``) and steps aside. The thinking routes will fail until
        the migration runs; everything else boots.
        """
        try:
            async with self._factory() as db:
                stuck = (
                    (
                        await db.execute(
                            select(Thinking).where(
                                Thinking.status.in_([ThinkingStatus.queued.value, ThinkingStatus.thinking.value])
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                for th in stuck:
                    await self._fail_stale(db, th)
                await db.commit()
        except (ProgrammingError, OperationalError) as exc:
            log.error(
                "thinking: the database is behind the code (%s). Run `invana migrate` — "
                "session asks will fail until the thinking tables exist.",
                type(exc.orig).__name__ if exc.orig else type(exc).__name__,
            )
            return
        if stuck:
            log.warning("thinking: failed %d stale thinking(s) left over from a previous run", len(stuck))

    async def shutdown(self) -> None:
        for task in list(self._tasks.values()):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)

    def submit(self, thinking_id: str) -> None:
        """Start (or resume) a thinking whose rows are already committed."""
        task = asyncio.create_task(self._run(thinking_id), name=f"invana.thinking.{thinking_id}")
        self._tasks[thinking_id] = task
        task.add_done_callback(lambda t: self._tasks.pop(thinking_id, None))

    async def cancel(self, thinking_id: str) -> bool:
        """Stop a running thinking. Returns False when nothing is running under that id."""
        task = self._tasks.get(thinking_id)
        if task is None or task.done():
            return False
        task.cancel()
        with contextlib.suppress(BaseException):
            await task
        return True

    # ── the loop ──────────────────────────────────────────────────────────────

    async def _run(self, thinking_id: str) -> None:
        try:
            await self._run_inner(thinking_id)
        except asyncio.CancelledError:
            task = asyncio.current_task()
            if task is not None:
                task.uncancel()
            await self._on_cancelled(thinking_id)
        except Exception as exc:
            log.exception("thinking %s crashed", thinking_id)
            await self._on_crash(thinking_id, exc)
        finally:
            broadcaster.close(thinking_id)

    async def _run_inner(self, thinking_id: str) -> None:
        emitter = Emitter(self._factory, thinking_id)
        started = time.perf_counter()
        async with self._factory() as db:
            th = await db.get(Thinking, thinking_id)
            if th is None or th.status not in {ThinkingStatus.queued.value, ThinkingStatus.thinking.value}:
                return
            thought = await db.get(Thought, th.thought_id)
            sess = await db.get(Session, thought.session_id)
            graph = await db.get(Graph, th.graph_id)
            assistant = await db.get(SessionMessage, th.assistant_message_id)
            assert thought and sess and graph and assistant
            user_msg = (
                await db.execute(
                    select(SessionMessage).where(
                        SessionMessage.session_id == sess.id, SessionMessage.seq == assistant.seq - 1
                    )
                )
            ).scalar_one()
            wf = WORKFLOWS[th.workflow_key]
            start_index = int((th.cursor or {}).get("step", 0))
            params = thought.params or {}
            mode = thought.kind
            surface = sess.surface.value if isinstance(sess.surface, SessionSurface) else str(sess.surface)

            provider = None
            if params.get("llm_provider_id"):
                provider = await LLMProviderStore().get(db, params["llm_provider_id"])
            history = assemble_history(
                await SessionStore().list_recent_messages(
                    db, session_id=sess.id, before_seq=user_msg.seq, limit=_HISTORY_TURNS * 2
                )
            )
            v = RunVars(
                graph=graph,
                sess=sess,
                actor_id=thought.author_id or "",
                encryption_key=self._key,
                user_message_id=user_msg.id,
                user_seq=user_msg.seq,
                assistant_message_id=assistant.id,
                mode=mode,
                prompt=user_msg.content,
                language=params.get("language"),
                timeout_s=params.get("timeout_s"),
                parameters=params.get("parameters"),
                provider=provider,
                history=history,
                grounding=await load_grounding(db, graph.id) if wf.key == "nl-query" else None,
            )

            th.status = ThinkingStatus.thinking.value
            th.started_at = _now()
            th.cursor = None
            await db.commit()
            add_message_in_flight(1, mode=mode, surface=surface)
            await emitter.emit(
                "thinking.started",
                {"thinking_id": th.id, "message_id": assistant.id, "workflow": wf.key, "started_at": th.started_at},
            )

            status_label = "error"
            try:
                outcome = await self._loop(db, emitter, th, wf, v, assistant, start_index)
                status_label = outcome
            finally:
                record_session_message(
                    mode=mode,
                    surface=surface,
                    duration_ms=(time.perf_counter() - started) * 1000,
                    status=status_label,
                )
                add_message_in_flight(-1, mode=mode, surface=surface)

    async def _loop(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: Thinking,
        wf,
        v: RunVars,
        assistant: SessionMessage,
        start_index: int,
    ) -> str:
        """Returns the metric status label: ok · clarify · error."""
        for i in range(start_index, len(wf.steps)):
            step = wf.steps[i]
            row = await self._row_for(db, th, assistant, i, step)
            attempt = row.attempt
            while True:
                row.status = StepStatus.running.value
                row.started_at = _now()
                await db.commit()
                await emitter.emit("step.started", _step_payload(row))
                ctx = TaskContext(db=db, manager=self._manager, emitter=emitter, step=row)
                try:
                    out = await TASKS[step.task_key](ctx, v)
                except NeedsInput as ni:
                    row.status = StepStatus.needs_input.value
                    row.finished_at = _now()
                    row.detail = f"needs input · {ni.detail}"[:255]
                    th.status = ThinkingStatus.awaiting_input.value
                    th.cursor = {"step": i}
                    await self._finish_needs_input(db, v, assistant, ni)
                    await db.commit()
                    await emitter.emit("step.needs_input", _step_payload(row))
                    await emitter.emit(
                        "clarification.requested",
                        {"question": ni.question, "options": ni.options, "message": message_payload(assistant)},
                    )
                    return "clarify"
                except TaskFailure as failure:
                    row.status = StepStatus.failed.value
                    row.finished_at = _now()
                    row.detail = f"failed · {failure.short}"[:255]
                    row.error = {"cls": failure.cls, "cause": failure.cause, "message": failure.message}
                    if failure.raw:
                        row.error["raw"] = failure.raw[:2000]
                    will_retry = failure.cls in step.retry.on and attempt < step.retry.max_attempts
                    await db.commit()
                    await emitter.emit("step.finished", _step_payload(row))
                    if will_retry:
                        attempt += 1
                        delay_ms = step.retry.delay_ms(attempt - 1, random.random())
                        row = ThinkingStep(
                            thinking_id=th.id,
                            message_id=assistant.id,
                            seq=i,
                            task_key=step.task_key,
                            label=step.label,
                            attempt=attempt,
                            status=StepStatus.queued.value,
                            detail=f"retrying {attempt}/{step.retry.max_attempts} · {failure.short}"[:255],
                        )
                        db.add(row)
                        await db.commit()
                        await emitter.emit(
                            "step.retrying",
                            {**_step_payload(row), "reason": failure.short, "delay_ms": round(delay_ms)},
                        )
                        await asyncio.sleep(delay_ms / 1000)
                        continue
                    await self._finish_failed(db, emitter, th, v, assistant, failure, attempts=attempt)
                    return "error"
                # settled
                row.status = StepStatus.succeeded.value
                row.finished_at = _now()
                row.detail = out.detail[:255]
                row.input = out.input or row.input
                row.output = out.output or row.output
                row.tokens_in = out.tokens_in if out.tokens_in is not None else row.tokens_in
                row.tokens_out = out.tokens_out if out.tokens_out is not None else row.tokens_out
                await db.commit()
                await emitter.emit("step.finished", _step_payload(row))
                break
        await self._finish_ok(db, emitter, th, v, assistant)
        return "ok"

    async def _row_for(
        self, db: AsyncSession, th: Thinking, assistant: SessionMessage, seq: int, step: Step
    ) -> ThinkingStep:
        """The queued row pre-created for this step under this reply, or a fresh one."""
        row = (
            (
                await db.execute(
                    select(ThinkingStep)
                    .where(
                        ThinkingStep.thinking_id == th.id,
                        ThinkingStep.message_id == assistant.id,
                        ThinkingStep.seq == seq,
                        ThinkingStep.status == StepStatus.queued.value,
                    )
                    .order_by(ThinkingStep.attempt.desc())
                )
            )
            .scalars()
            .first()
        )
        if row is not None:
            return row
        prior = (
            (
                await db.execute(
                    select(ThinkingStep.attempt)
                    .where(ThinkingStep.thinking_id == th.id, ThinkingStep.seq == seq)
                    .order_by(ThinkingStep.attempt.desc())
                )
            )
            .scalars()
            .first()
        )
        row = ThinkingStep(
            thinking_id=th.id,
            message_id=assistant.id,
            seq=seq,
            task_key=step.task_key,
            label=step.label,
            attempt=(prior or 0) + 1,
        )
        db.add(row)
        await db.flush()
        return row

    # ── settling the reply ────────────────────────────────────────────────────

    async def _finish_ok(self, db: AsyncSession, emitter: Emitter, th: Thinking, v: RunVars, m: SessionMessage) -> None:
        sess = v.sess
        m.status = SessionMessageStatus.ok
        m.timeout_s = v.timeout_s
        if th.workflow_key == "modeller-generate":
            assert v.proposal is not None and v.counts is not None
            m.via = v.via
            m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
            m.content = _model_summary(v.proposal.summary, v.counts)
        else:
            r = v.result
            assert r is not None
            m.source_query = v.query
            m.query_language = r.query_language
            m.via = v.via or {"cypher": "Cypher", "gremlin": "Gremlin"}.get(r.query_language, r.query_language)
            m.rationale = v.rationale
            m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
            m.row_count = r.row_count
            m.execution_time_ms = r.execution_time_ms
            m.node_count = v.nodes
            m.edge_count = v.edges
            m.content = v.summary or ""
            sess.node_count += v.nodes
            sess.edge_count += v.edges
        await self._settle(db, emitter, th, v, m, ThinkingStatus.succeeded)

    async def _finish_needs_input(self, db: AsyncSession, v: RunVars, m: SessionMessage, ni: NeedsInput) -> None:
        m.status = SessionMessageStatus.ok
        m.content = ni.question
        m.clarification_options = ni.options or None
        m.via = v.via
        m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
        m.timeout_s = v.timeout_s
        v.sess.last_status = m.status
        if not v.sess.title:
            v.sess.title = _title_from_text(v.prompt)

    async def _finish_failed(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: Thinking,
        v: RunVars,
        m: SessionMessage,
        failure: TaskFailure,
        *,
        attempts: int,
    ) -> None:
        m.status = SessionMessageStatus.error
        m.source_query = v.query if v.query and th.workflow_key != "modeller-generate" else m.source_query
        m.via = v.via or m.via
        m.rationale = v.rationale or m.rationale
        m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else m.llm_time_ms
        m.timeout_s = v.timeout_s
        if failure.cause in {"timeout", "query_invalid", "db_error"} and v.mode == "nl":
            category = {"timeout": "timeout", "query_invalid": "syntax"}.get(failure.cause, "unknown")
            m.content = _friendly_query_error(category)
        else:
            m.content = failure.message
        th.error = {"cls": failure.cls, "cause": failure.cause, "message": failure.message}
        await emitter.emit("diagnosis", diagnose(failure, mode=v.mode, attempts=attempts))
        await self._settle(db, emitter, th, v, m, ThinkingStatus.failed)

    async def _settle(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: Thinking,
        v: RunVars,
        m: SessionMessage,
        status: ThinkingStatus,
    ) -> None:
        sess = v.sess
        sess.last_status = m.status
        if not sess.title:
            sess.title = _title_from_text(v.prompt)
        th.status = status.value
        th.finished_at = _now()
        await emit_event(
            db,
            action=actions.THINKING_FINISH,
            target_kind=actions.TARGET_SESSION,
            target_id=sess.id,
            graph_id=v.graph.id,
            actor_id=None,
            actor_type=ActorType.system,
            details={
                "thinking_id": th.id,
                "workflow": th.workflow_key,
                "status": status.value,
                "duration_ms": _ms(th.started_at, th.finished_at),
            },
        )
        await db.commit()
        await emitter.emit(
            "thinking.done",
            {"thinking_id": th.id, "status": status.value, "message": message_payload(m)},
        )

    # ── abnormal endings ──────────────────────────────────────────────────────

    async def _on_cancelled(self, thinking_id: str) -> None:
        emitter = Emitter(self._factory, thinking_id)
        async with self._factory() as db:
            th = await db.get(Thinking, thinking_id)
            if th is None:
                return
            m = await db.get(SessionMessage, th.assistant_message_id) if th.assistant_message_id else None
            # Only the step that was running is "stopped"; the ones after it stay
            # queued so the list shows how far the run got (UC9).
            for row in await self._open_rows(db, th):
                if row.status == StepStatus.running.value:
                    row.status = StepStatus.stopped.value
                    row.finished_at = _now()
                    row.detail = "stopped"
            th.status = ThinkingStatus.cancelled.value
            th.finished_at = _now()
            if m is not None:
                m.status = SessionMessageStatus.stopped
                m.content = "Stopped by you."
                sess = await db.get(Session, m.session_id)
                if sess is not None:
                    sess.last_status = m.status
            await emit_event(
                db,
                action=actions.THINKING_CANCEL,
                target_kind=actions.TARGET_SESSION,
                target_id=m.session_id if m else None,
                graph_id=th.graph_id,
                actor_id=None,
                actor_type=ActorType.system,
                details={"thinking_id": th.id},
            )
            await db.commit()
            await emitter.emit(
                "thinking.cancelled",
                {"thinking_id": th.id, "status": th.status, "message": message_payload(m) if m else None},
            )

    async def _on_crash(self, thinking_id: str, exc: BaseException) -> None:
        emitter = Emitter(self._factory, thinking_id)
        failure = internal_failure(exc)
        async with self._factory() as db:
            th = await db.get(Thinking, thinking_id)
            if th is None:
                return
            for row in await self._open_rows(db, th):
                row.status = StepStatus.failed.value
                row.finished_at = _now()
                row.detail = "failed · engine error"
                row.error = {"cls": "defect", "cause": "internal", "message": failure.message}
            th.status = ThinkingStatus.failed.value
            th.finished_at = _now()
            th.error = {"cls": "defect", "cause": "internal", "message": failure.message, "raw": repr(exc)[:2000]}
            m = await db.get(SessionMessage, th.assistant_message_id) if th.assistant_message_id else None
            if m is not None:
                m.status = SessionMessageStatus.error
                m.content = failure.message
                sess = await db.get(Session, m.session_id)
                if sess is not None:
                    sess.last_status = m.status
            await db.commit()
            with contextlib.suppress(Exception):
                await emitter.emit("diagnosis", diagnose(failure, mode="nl", attempts=1))
                await emitter.emit(
                    "thinking.done",
                    {"thinking_id": th.id, "status": th.status, "message": message_payload(m) if m else None},
                )

    async def _fail_stale(self, db: AsyncSession, th: Thinking) -> None:
        for row in await self._open_rows(db, th):
            row.status = StepStatus.failed.value
            row.finished_at = _now()
            row.detail = "failed · the engine restarted while this was running"
            row.error = {"cls": "defect", "cause": "internal", "message": "engine restarted"}
        th.status = ThinkingStatus.failed.value
        th.finished_at = _now()
        th.error = {"cls": "defect", "cause": "internal", "message": "The engine restarted while this was running."}
        if th.assistant_message_id:
            m = await db.get(SessionMessage, th.assistant_message_id)
            if m is not None and m.status == SessionMessageStatus.running:
                m.status = SessionMessageStatus.error
                m.content = "The engine restarted while this was running."
                sess = await db.get(Session, m.session_id)
                if sess is not None:
                    sess.last_status = m.status

    async def _open_rows(self, db: AsyncSession, th: Thinking) -> list[ThinkingStep]:
        return list(
            (
                await db.execute(
                    select(ThinkingStep).where(
                        ThinkingStep.thinking_id == th.id,
                        ThinkingStep.status.in_([StepStatus.queued.value, StepStatus.running.value]),
                    )
                )
            ).scalars()
        )
