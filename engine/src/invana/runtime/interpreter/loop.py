"""The inline runtime — one ``asyncio`` task per run (docs/for-developers/modules/ask/spec.md ``inline`` adapter).

``TaskRuntime`` owns the interpreter loop of docs/for-developers/modules/ask/features/streaming-and-the-workflow.md:
for each step of
the flow, mark the row running, run the task, and settle the row as
succeeded / failed / needs_input / stopped — retrying on the classes the step's
policy allows (docs/for-developers/modules/ask/features/when-it-cannot-answer.md), emitting a ``diagnosis`` on a
terminal failure and
writing the assistant reply exactly as the synchronous path used to when the
run ends. It holds **one** DB session for the run (like the request it
replaces) and commits at every step boundary so subscribers replaying from the
record see the same transitions a live tail did.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import random
import time
from datetime import UTC, datetime
from typing import Any, ClassVar, Protocol

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.agents.envelope import Envelope
from invana.apps.agents.models import Agent, layered_instructions
from invana.apps.govern.guardrail import parse_target
from invana.apps.govern.managers.request import RequestManager, asker_of
from invana.apps.govern.models import Request, RequestKind
from invana.apps.govern.querysets import LensQuerySet
from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.llm.pricing import cost_usd
from invana.apps.llm.voice import voice_for
from invana.apps.modeller.managers import CountSnapshotManager
from invana.apps.sessions.models import Session, SessionMessage, SessionMessageStatus
from invana.apps.sessions.querysets import SessionMessageQuerySet
from invana.apps.sessions.transcript import (
    _HISTORY_TURNS,
    _friendly_query_error,
    _model_summary,
    _title_from_text,
)
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.models import Rule, Skill, SkillAtVersion, SkillVersion
from invana.apps.work.models import Task as Todo
from invana.core.events import actions
from invana.core.events.models import ActorKind, ActorType
from invana.core.events.services import emit_event
from invana.core.querylog import calling_as
from invana.core.settings import settings
from invana.core.telemetry.recorders import add_run_active, record_run, record_run_admitted
from invana.core.telemetry.spans import add_event, current_ids, current_span_context, set_current
from invana.plugins import load_plugins
from invana.plugins.core.ingest.records import LoadRefused, connector_for
from invana.plugins.sdk.manifest import SideEffect
from invana.runtime import ledger_acts
from invana.runtime.access import AccessGate
from invana.runtime.callers import caller_for
from invana.runtime.catalogue import (
    CannotAnswer,
    Converse,
    LoadVars,
    NeedsInput,
    RunVars,
    TaskContext,
    TaskFailure,
    context_turns,
    load_global_model,
    load_grounding,
)
from invana.runtime.contention import AgentAtCeiling, AgentSlots, GraphSlots, PoolSlots, Refused
from invana.runtime.delegation import (
    budget_of,
    cost_rollup,
    descendants,
    end_waiting_children,
    settle_escrow,
    spent,
)
from invana.runtime.diagnosis import diagnose, internal_failure
from invana.runtime.executor import _dispatch, refuse_disabled, tool_manifest
from invana.runtime.governing import Governor
from invana.runtime.interpreter.bindings import resolve as resolve_bindings
from invana.runtime.interpreter.payloads import (
    _OUTCOME_BY_STATUS,
    _awaiting_detail,
    _now,
    _retry_for,
    _step_payload,
    message_payload,
)
from invana.runtime.interpreter.tracing import (
    crash_logged,
    delegation_links,
    log_run_ended,
    log_run_started,
    run_span,
    step_span,
)
from invana.runtime.models import ExitReason, RunRole, RunStatus, TaskRun, span_ms
from invana.runtime.planning import plan_payload, queue_plan_steps
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.results import roll_up_run, run_result, run_tokens, step_result
from invana.runtime.services import BULK_PLAN_KEY, LOAD_PLAN_KEY, endpoint_for_run, record_stop
from invana.runtime.stream import Emitter, broadcaster
from invana.runtime.workflows import WORKFLOWS, Step

#: The plans whose end leaves a count snapshot behind (the-model-page.md MP30).
_IMPORT_PLAN_KEYS = frozenset({LOAD_PLAN_KEY, BULK_PLAN_KEY})

log = logging.getLogger(__name__)

_requests = RequestManager()
_lenses = LensQuerySet()

#: The refusals a Graph guardrail makes — the property is kept out, or counted only.
#: The refusal each one makes, and the guardrail access that makes it.
_GUARDED = {"lens_property_excluded": "never", "lens_property_counts_only": "counts"}

#: How long a ``send`` step's approval waits for its approver.
SEND_APPROVAL_DEADLINE_S = 86400
#: How long any other ask — a delegation, a budget — waits for its approver.
ASK_DEADLINE_S = 86400

#: How many identical calls in a row, with nothing new from any, end a run as making no progress.
NO_PROGRESS_REPEATS = 3

#: A step failure's cause → the reason its run ended, where the cause names one.
_EXIT_BY_CAUSE = {
    "budget_declined": ExitReason.budget_declined,
    "time_limit": ExitReason.time_limit,
    "step_limit": ExitReason.step_limit,
    "max_steps": ExitReason.step_limit,
    "no_progress": ExitReason.no_progress,
    "loop": ExitReason.loop,
}

#: A step failure's cause → the ledger's refusal reason, for a step refused on a bound.
_REFUSED_BY_CAUSE = {
    "bound_exceeded": "ceiling",
    "budget_declined": "ceiling",
    "step_limit": "ceiling",
    "max_steps": "ceiling",
    "robots_disallowed": "robots",
    "policy": "policy",
    "loop": "policy",
    "delegation_declined": "policy",
    "secret_undeclared": "grant",
    "policy_refused": "grant",
    "plugin_disabled": "policy",
}


class SendGate(Protocol):
    """Where a ``send`` step's approval is asked for and read back.

    The approvals inbox sits above the runtime, so the runtime names only this
    shape and the edge that owns the inbox installs one on
    :attr:`TaskRuntime.send_gate`. ``decision`` returns the approval's status
    (``pending · approved · declined · expired``) and who decided it, by name.
    """

    async def request(
        self,
        db: AsyncSession,
        *,
        graph_id: str,
        run_id: str,
        step_id: str,
        title: str,
        payload: dict,
        approver_id: str,
        deadline_s: int,
    ) -> str: ...

    async def decision(self, db: AsyncSession, *, approval_id: str) -> tuple[str, str]: ...


class AskGate(Protocol):
    """Where a step asks a person for something — a delegation, more budget — and reads it back.

    The same seam as :class:`SendGate`, for every ask that is not a send: the
    edge that owns the approvals inbox installs one on
    :attr:`TaskRuntime.ask_gate`. ``ask`` creates the approval — ``kind`` is the
    reader's word (``delegation`` · ``budget``), ``asked_by`` the chain from the
    person to the asking agent, ``routed_reason`` why it went to
    ``approver_ids`` — and returns its id. ``verdict`` returns the status
    (``pending · approved · declined · expired``), who decided it by name, and
    the scope it was approved with (``run`` · ``always``).

    The step that asked holds — polling ``verdict`` — and the rest of its run
    carries on; with no gate installed the step is refused, never waved through.
    """

    async def ask(
        self,
        db: AsyncSession,
        *,
        kind: str,
        graph_id: str,
        run_id: str | None,
        step_run_id: str | None,
        asked_by: list[dict],
        wants: str,
        routed_reason: str,
        approver_ids: list[str],
        payload: dict,
        title: str | None = None,
        deadline_s: int = ASK_DEADLINE_S,
    ) -> str: ...

    async def verdict(self, db: AsyncSession, *, approval_id: str) -> tuple[str, str, str | None]: ...


def exit_reason_for(status: str, *, outcome: str | None = None, cause: str | None = None) -> str:
    """The one reason a run ended, from how it settled.

    Succeeded is *served*, or *cannot answer* when that was its outcome; failed
    is the specific reason its cause names, else *failed*. Cancellation is
    decided by whoever cancelled — :meth:`TaskRuntime.cancel` — not here.
    """
    if status == RunStatus.succeeded.value:
        return (ExitReason.cannot_answer if outcome == "cannot_answer" else ExitReason.served).value
    if status == RunStatus.cancelled.value:
        return ExitReason.stopped.value
    return _EXIT_BY_CAUSE.get(cause or "", ExitReason.failed).value


def _no_progress(recent: list[tuple[str, str, str]], row: TaskRun) -> bool:
    """Remember a settled call; True once the last few were one call with nothing new from any.

    The same function, with the same bound arguments, returning the same output
    :data:`NO_PROGRESS_REPEATS` times in a row is a run going round in place.
    """
    recent.append((row.task_key, _canonical(row.args), _canonical(row.output)))
    del recent[:-NO_PROGRESS_REPEATS]
    return len(recent) == NO_PROGRESS_REPEATS and len(set(recent)) == 1


def _canonical(value: Any) -> str:
    return json.dumps(value or {}, sort_keys=True, default=str)


def _seconds_since(then: datetime | None) -> float:
    """Seconds from *then* to now, never negative; a naive time is read as UTC."""
    if then is None:
        return 0.0
    if then.tzinfo is None:
        then = then.replace(tzinfo=UTC)
    return max((_now() - then).total_seconds(), 0.0)


class TaskRuntime:
    """Runs runs in-process. Created in the app lifespan; stubbed in route tests."""

    #: The approvals inbox a ``send`` step holds on, installed process-wide by
    #: the edge that owns it. With none installed a ``send`` step is refused,
    #: never sent unapproved.
    send_gate: ClassVar[SendGate | None] = None
    #: The approvals inbox every other ask holds on — a delegation to an agent
    #: that asks each time. With none installed such a step is refused.
    ask_gate: ClassVar[AskGate | None] = None
    #: The policy layers every step with a bound passes before it dispatches.
    access_gate: ClassVar[AccessGate] = AccessGate()

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
        # Span context of every run whose span is open here, so a delegated
        # child can link to its parent run's span.
        self._run_span_ctx: dict[str, Any] = {}
        # The Graph's ceiling and its wait queue
        # (docs/for-developers/modules/agents/features/concurrency-and-contention.md).
        # A budget bounds one agent; this bounds the Graph.
        self._slots = GraphSlots()
        # The other two bounds in the same family (contention.py): how many runs
        # one **agent** works at once, and how many crossings may be in flight in
        # each of the Graph's named pools. One per process, like the queue (CC7).
        self._agent_slots = AgentSlots()
        self._pools = PoolSlots()
        # Rules are Skills' rule, read here rather than reimplemented.
        self._rules = RuleManager()
        # Why each run being cancelled ends, and who stopped it, keyed by run id:
        # the run a person stopped ends `stopped`, every run under it `parent_ended`.
        self._cancelled: dict[str, tuple[str, str | None]] = {}

    # ── lifecycle ─────────────────────────────────────────────────────────────

    async def startup(self) -> int:
        """Fail whatever was mid-flight when the process died — nothing streams forever.

        A database that hasn't had migration 28 applied yet has no ``runs``
        table; that must not take the whole API down, so the sweep logs the fix
        (``invana migrate``) and steps aside. The run routes will fail until
        the migration runs; everything else boots.

        Returns how many stale runs it failed — 0 when the run tables are missing.
        """
        try:
            async with self._factory() as db:
                stuck = (
                    (
                        await db.execute(
                            select(TaskRun).where(TaskRun.status.in_([RunStatus.queued.value, RunStatus.running.value]))
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
                "run: the database is behind the code (%s). Run `invana migrate` — "
                "session asks will fail until the run tables exist.",
                type(exc.orig).__name__ if exc.orig else type(exc).__name__,
            )
            return 0
        if stuck:
            log.warning("run: failed %d stale run(s) left over from a previous run", len(stuck))
        return len(stuck)

    async def shutdown(self) -> None:
        for task in list(self._tasks.values()):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)

    def submit(self, run_id: str) -> None:
        """Start (or resume) a run whose rows are already committed.

        Admission against the Graph's ceiling happens inside ``_run`` rather than
        here, because it needs the Graph row and this is a synchronous call from a
        route that has already committed. A run that has to wait does so as a
        **queued** run with a position, not as a caller blocked on a lock
        (CC5).
        """
        # The task name is a debugging label, not a module path — literal on
        # purpose, so it survives the package rename (refactor-plan.md §2).
        task = asyncio.create_task(self._run(run_id), name=f"invana.run.{run_id}")
        self._tasks[run_id] = task
        task.add_done_callback(lambda t: self._tasks.pop(run_id, None))

    async def resume_after_decision(self, run_id: str) -> bool:
        """Continue a run held on a ``send`` approval once that approval is decided.

        Called after the decision has committed. The run goes back to queued
        and resumes at the held step — the same step row, so the pass reads the
        decision through the approval id the row carries: approved sends,
        declined fails the step as *not sent*. Returns False, doing nothing, for
        a run that is not held on an approval.
        """
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            if th is None or th.status != RunStatus.awaiting_input.value or not (th.cursor or {}).get("approval"):
                return False
            th.status = RunStatus.queued.value
            th.finished_at = None
            await db.commit()
        self.submit(run_id)
        return True

    async def run_inline(self, run_id: str) -> None:
        """Run a committed run in the caller's own request, and return when it settles.

        For an act a person is waiting on (RP31): the run is
        the same record ``submit`` would make — plan, lens, stream, trace — only
        the caller awaits it instead of polling. Admission still happens inside
        ``_run``, so a Graph at its ceiling queues this run like any other.
        """
        task = asyncio.create_task(self._run(run_id), name=f"invana.run.{run_id}")
        self._tasks[run_id] = task
        try:
            await task
        finally:
            self._tasks.pop(run_id, None)

    def submit_eval(self, run_id: str) -> None:
        """Work an eval run whose rows are committed: each replay in turn, then the score.

        The replays run one after another, not at once, so an eval run never
        takes more of the Graph's ceiling than one ask and its latencies are
        not each other's queueing. A run that settled at open (*paused:
        budget*) has no children and is not scored.
        """
        task = asyncio.create_task(self._eval(run_id), name=f"invana.eval.{run_id}")
        self._tasks[run_id] = task
        task.add_done_callback(lambda t: self._tasks.pop(run_id, None))

    async def eval_inline(self, run_id: str) -> None:
        """Work a committed eval run in the caller's own process, and return when it is scored.

        For the CLI, which has no server runtime to hand the run to: the same
        replays and score ``submit_eval`` would run, awaited.
        """
        await self._eval(run_id)

    async def _eval(self, run_id: str) -> None:
        from invana.runtime.managers.evals import EvalManager

        evals = EvalManager()
        async with self._factory() as db:
            root = await TaskRunQuerySet().get(db, run_id)
            if root is None or root.status != RunStatus.queued.value:
                return
            root.status = RunStatus.running.value
            root.started_at = _now()
            children = [c.id for c in await evals.case_runs(db, run_id=run_id)]
            await db.commit()
        for child_id in children:
            await self._run(child_id)
        async with self._factory() as db:
            try:
                await evals.score(db, run_id=run_id, encryption_key=self._key)
                await db.commit()
            except Exception as exc:
                await db.rollback()
                log.error("eval run failed to score", exc_info=exc, extra={"run_id": run_id})
                root = await TaskRunQuerySet().get(db, run_id)
                if root is not None:
                    root.status = RunStatus.failed.value
                    root.outcome = "failed"
                    root.exit_reason = ExitReason.failed.value
                    root.finished_at = _now()
                    root.error = {"cls": "defect", "cause": "internal", "message": "The eval run could not be scored."}
                    await self._roll_up_run(db, root)
                    await db.commit()

    def contention(self, graph_id: str, pools: dict[str, int] | None = None) -> dict:
        """What is running in this Graph, what is waiting behind it, and how full
        its pools are (CC5 · CC8 · C8).

        ``pools`` is the Graph's configuration, handed in by the caller that
        read the row — the runtime accounts for what is *in* a pool and has no
        opinion about how big it is.
        """
        return {**self._slots.snapshot(graph_id), "pools": self._pools.snapshot(graph_id, pools or {})}

    async def _agent_has_room(self, db: AsyncSession, th: TaskRun, emitter: Emitter) -> bool:
        """The **agent's** own simultaneity ceiling, checked before the Graph's.

        ``max_concurrent_runs`` on the budget bounds how many runs one agent is
        working at once, which is a different bound from the Graph's ceiling
        ([CC1](docs/for-developers/modules/agents/features/concurrency-and-contention.md)):
        one bounds an actor, the other bounds the machine. Checked first so an
        agent at its own bound is told *that*, rather than queued behind a
        Graph ceiling it was never going to reach.

        It **refuses and does not queue** — an agent has no policy column, and a
        second queue with its own precedence would make *why am I waiting* two
        answers instead of one. The refusal names the ceiling
        ([EB3](docs/for-developers/modules/agents/features/envelope-and-budget.md)).

        A run with no agent has no such bound, which is the widest reading and
        the honest one.
        """
        if not th.agent_id:
            return True
        agent = await db.get(Agent, th.agent_id)
        if agent is None:
            return True
        ceiling = int(agent.effective_budget.get("max_concurrent_runs") or 0)
        try:
            self._agent_slots.take(agent_id=th.agent_id, run_id=th.id, ceiling=ceiling)
        except AgentAtCeiling as at:
            await emitter.emit(
                "run.refused_agent_ceiling",
                {"agent_id": at.agent_id, "ceiling": at.ceiling, "running": at.running},
            )
            th.status = RunStatus.failed.value
            th.outcome = "failed"
            th.exit_reason = ExitReason.failed.value
            th.finished_at = _now()
            await settle_escrow(db, th)
            th.error = {
                "cls": "bound",
                "cause": "agent_ceiling",
                "message": f"{agent.name} is already working {at.running} of {at.ceiling} runs. "
                "Try again when one finishes, or raise the agent's ceiling.",
            }
            await db.commit()
            return False
        return True

    async def _await_slot(self, db: AsyncSession, th: TaskRun, emitter: Emitter) -> bool:
        """Take a slot for *th*, waiting or refusing as the Graph's policy says.

        Returns False when the run was refused — the caller settles it as failed,
        naming the ceiling. A wait polls rather than holding a condition variable:
        the queue is small, the wait is measured in seconds of other people's
        queries, and a poll is the version that cannot deadlock on a task that
        died without releasing.
        """
        if not await self._agent_has_room(db, th, emitter):
            return False

        graph = await db.get(Graph, th.graph_id)
        ceiling = getattr(graph, "max_concurrent_runs", 0) or 0
        policy = getattr(graph, "concurrency_policy", "queue") or "queue"
        if ceiling <= 0:
            return True

        try:
            admission = self._slots.admit(
                graph_id=th.graph_id,
                run_id=th.id,
                ceiling=ceiling,
                policy=policy,
                triggered_by=th.triggered_by,
            )
        except Refused as refused:
            await emitter.emit(
                "run.refused_ceiling",
                {"ceiling": refused.ceiling, "running": refused.running, "graph_id": th.graph_id},
            )
            th.status = RunStatus.failed.value
            th.outcome = "failed"
            th.exit_reason = ExitReason.failed.value
            th.finished_at = _now()
            await settle_escrow(db, th)
            th.error = {
                "cls": "bound",
                "cause": "graph_ceiling",
                # The bound by name — never "something went wrong" (CC6).
                "message": f"This Graph runs at most {refused.ceiling} runs at once, "
                f"and {refused.running} are running. Try again when one finishes.",
            }
            await db.commit()
            return False

        if admission.admitted:
            return True

        # Queued is a state a person can read, with what it is waiting behind.
        queued = {"position": admission.position, "ceiling": admission.ceiling, "running": admission.running}
        await emitter.emit("run.queued", queued)
        add_event("run.queued", queued)
        while True:
            await asyncio.sleep(0.25)
            if th.id in self._slots.snapshot(th.graph_id)["running"]:
                await emitter.emit("run.started", {"waited": True})
                add_event("run.admitted", {"waited": True})
                return True

    async def cancel(self, run_id: str, *, stopped_by: str | None = None) -> bool:
        """Stop a running run, and everything it delegated to.

        The cascade walks ``parent_run_id`` **down** (docs/for-developers/modules/work/spec.md):
        cancelling a parent while its children keep spending budget would make
        the stop button a lie. The run named here ends ``stopped`` — a
        ``run.stop`` event by ``stopped_by`` (else the person it ran for) — and
        every run under it ends ``parent_ended``; a child still waiting for room
        and never started is ended in place.
        """
        children: list[str] = []
        async with self._factory() as db:
            with contextlib.suppress(Exception):
                children = await descendants(db, run_id)
            # A queued run leaves the line; the others move up on their own
            # (concurrency-and-contention.md — "a queued task cancelled").
            th = await TaskRunQuerySet().get(db, run_id)
            if th is not None:
                self._slots.withdraw(graph_id=th.graph_id, run_id=run_id)
            waiting = [c for c in children if c not in self._tasks or self._tasks[c].done()]
            with contextlib.suppress(Exception):
                for child in await end_waiting_children(db, waiting):
                    self._slots.withdraw(graph_id=child.graph_id, run_id=child.id)
                await db.commit()
        self._cancelled[run_id] = (ExitReason.stopped.value, stopped_by)
        for child in children:
            self._cancelled[child] = (ExitReason.parent_ended.value, stopped_by)
        stopped = False
        # The stopped run first: a parent that saw its child cancelled before its
        # own stop arrived would end `failed` on a delegation, not `stopped`.
        for target in [run_id, *children]:
            task = self._tasks.get(target)
            if task is None or task.done():
                self._cancelled.pop(target, None)
                continue
            task.cancel()
            with contextlib.suppress(BaseException):
                await task
            self._cancelled.pop(target, None)
            stopped = True
        return stopped

    # ── the loop ──────────────────────────────────────────────────────────────

    async def _run(self, run_id: str) -> None:
        try:
            await self._run_inner(run_id)
        except asyncio.CancelledError:
            task = asyncio.current_task()
            if task is not None:
                task.uncancel()
            await self._on_cancelled(run_id)
        except Exception as exc:
            # Normally logged inside the run's span; a crash before it opened is logged here.
            if not crash_logged(exc):
                log.error("run failed", exc_info=exc, extra={"run_id": run_id, "failure_kind": "defect·internal"})
            await self._on_crash(run_id, exc)
        finally:
            # The slot goes back whatever happened, and the next in line takes it
            # — a run that crashed must not hold the Graph's ceiling down.
            await self._release_slot(run_id)
            broadcaster.close(run_id)

    async def _release_slot(self, run_id: str) -> None:
        """Give back everything this run held — the Graph slot, its agent's, and
        any pool slot a crossing died without closing."""
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            if th is None:
                return
            self._slots.release(graph_id=th.graph_id, run_id=run_id)
            if th.agent_id:
                self._agent_slots.release(agent_id=th.agent_id, run_id=run_id)
            self._pools.release_run(graph_id=th.graph_id, run_id=run_id)

    async def _run_inner(self, run_id: str) -> None:
        # Every query this run asks is asked for someone — or for no one, and then
        # it is not logged (the-model-page.md MP35).
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            caller = await caller_for(db, th) if th is not None else None
            links = await delegation_links(db, th, self._run_span_ctx) if th is not None else ()
        # A run is a span of the action that started it; a missing row opens none.
        with run_span(th, links=links) if th is not None else contextlib.nullcontext():
            self._run_span_ctx[run_id] = current_span_context()
            try:
                await self._stamp_trace(run_id)
                with calling_as(caller):
                    await self._run_body(run_id)
            finally:
                self._run_span_ctx.pop(run_id, None)

    async def _stamp_trace(self, run_id: str) -> None:
        """Write the open run span's ids onto the run row, so the run opens its trace.

        Called once the ``invana.run`` span is current. It sets ``root_span_id``
        and fills ``trace_id`` only when the insert found no trace (a run queued
        outside any span). The first run span wins: a resumed run opens a second
        span and leaves both ids as they were. Without telemetry there is no span
        and nothing is written.
        """
        trace_id, span_id = current_ids()
        if span_id is None:
            return
        async with self._factory() as db:
            await TaskRunQuerySet().stamp_trace(db, run_id, trace_id=trace_id, span_id=span_id)
            await db.commit()

    async def _run_body(self, run_id: str) -> None:
        """Work one pass of a run: take a slot, build its vars, run the loop, settle.

        **Metrics.** The run's labels are those of its span — ``kind``
        (``ask_kind``, else ``todo``), ``role`` and ``triggered_by``. The first
        admission records the wait since the run was queued on
        ``invana.runs.queue_wait``; a resumed pass, whose row waited on a person
        rather than a slot, records none. From the moment the row is marked
        running the pass counts on ``invana.runs.active``, and when it ends —
        settled, paused for input, cancelled or crashed — it is taken off and
        recorded once on ``invana.runs.count`` / ``invana.runs.duration`` with
        its outcome (the loop's label, ``cancelled`` or ``error``). A run
        refused a slot never worked and records neither.

        **Logs.** The same span brackets two lines: ``run started`` once the row
        is running, and one ending line named for the outcome (see
        ``invana.runtime.interpreter.tracing``). An exception escaping the pass
        writes no ending line here — the run span logs it, once.
        """
        emitter = Emitter(self._factory, run_id)
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            if th is None or th.status not in {RunStatus.queued.value, RunStatus.running.value}:
                return
            # The Graph's ceiling, before anything else runs: a slot, a place in
            # the queue with a position, or a refusal naming the bound
            # (docs/for-developers/modules/agents/features/concurrency-and-contention.md).
            if not await self._await_slot(db, th, emitter):
                return
            labels = {"kind": th.ask_kind or "todo", "role": th.role, "triggered_by": th.triggered_by}
            if th.started_at is None:
                record_run_admitted(**labels, queue_wait_s=_seconds_since(th.queued_at))
            started = time.perf_counter()
            # A cursor exists only after a pause for input, so it is also how a
            # run knows it is *resuming* — from this step.
            start_index = int((th.cursor or {}).get("step", 0))
            # **Lenient, because a library plan is the normal case now**
            # (task-model-migration § 6.5). `flow_key` on an import run is
            # `dataset-import@1`, which `WORKFLOWS` does not hold and is not
            # meant to: the three keys left in it are what a session opens
            # against, and they retire in M12. Subscripting here is what kept
            # ingestion running inline — the run raised `KeyError` before a
            # single node was dispatched.
            wf = WORKFLOWS.get(th.flow_key)
            v, assistant = await self.run_vars(db, th)

            th.status = RunStatus.running.value
            th.started_at = _now()
            th.cursor = None
            await db.commit()
            add_run_active(1, **labels)
            log_run_started(th)
            outcome = "error"
            crashed = False
            try:
                await emitter.emit(
                    "run.started",
                    {
                        "run_id": th.id,
                        "message_id": assistant.id if assistant else None,
                        "flow": th.flow_key,
                        "agent_id": th.agent_id,
                        "agent": v.agent.name if v.agent else None,
                        "task_id": th.todo_id,
                        "started_at": th.started_at,
                    },
                )
                outcome = await self._loop(db, emitter, th, wf, v, assistant, start_index)
            except asyncio.CancelledError:
                outcome = "cancelled"
                raise
            except Exception:
                crashed = True
                raise
            finally:
                duration_s = time.perf_counter() - started
                add_run_active(-1, **labels)
                record_run(**labels, outcome=outcome, duration_s=duration_s)
                set_current(**{"invana.outcome": outcome})
                # A crash is logged once, by the run span, with its traceback.
                if not crashed:
                    # A stop that lands mid-flush leaves the session rolled back, and the
                    # log line's read of `th` would raise in its place: the run would then
                    # end `failed` instead of `stopped`. The ledger write is `_on_cancelled`'s.
                    try:
                        log_run_ended(th, outcome, duration_s)
                    except Exception:
                        if outcome != "cancelled":
                            raise

    async def run_vars(self, db: AsyncSession, th: TaskRun) -> tuple[RunVars, SessionMessage | None]:
        """Everything a step reads about its run, rebuilt from the run row's ids.

        The pass calls it once before its loop; a worker calls it for each
        envelope it is handed, so a step sees the same Graph, session, provider,
        skills, rules, voice and frozen lens wherever it runs. Returns the vars
        and the reply row they write into (None for a task-triggered run).

        It reads and does not commit; the one column it may set is
        ``model_version``, through :meth:`_provider_for`.
        """
        run_ask = th
        graph = await db.get(Graph, th.graph_id)
        assert run_ask and graph
        # A task-triggered or delegated run has no session and no
        # reply row. Everything below tolerates both being None, which is
        # what makes "a task is worked through as runs" true rather
        # than aspirational.
        sess = await db.get(Session, run_ask.session_id) if run_ask.session_id else None
        assistant = await db.get(SessionMessage, th.assistant_message_id) if th.assistant_message_id else None
        user_msg = None
        if sess is not None and assistant is not None:
            user_msg = (
                await db.execute(
                    select(SessionMessage).where(
                        SessionMessage.session_id == sess.id, SessionMessage.seq == assistant.seq - 1
                    )
                )
            ).scalar_one_or_none()

        # A cursor exists only after a pause for input, so it is also how a
        # run knows it is *resuming*: this pass answers `question`, and
        # `prompt` below is the answer the user gave.
        cursor = th.cursor or {}
        answering = cursor.get("question")
        params = run_ask.params or {}
        mode = run_ask.ask_kind

        agent = await db.get(Agent, th.agent_id) if th.agent_id else None
        provider = await self._provider_for(db, th=run_ask)
        # An eval replay names the candidate it replays: a skill version in
        # place of the head, or an agent's draft instructions.
        replay = params.get("eval") or {}
        skills = await self._skills_for(db, agent=agent, graph_id=graph.id, replay=replay)
        rules = await self._rules_for(db, run=th, graph_id=graph.id)
        history = (
            context_turns(
                await SessionMessageQuerySet().list_recent_messages(
                    db, session_id=sess.id, before_seq=user_msg.seq, limit=_HISTORY_TURNS * 2
                )
            )
            if sess is not None and user_msg is not None
            else []
        )
        v = RunVars(
            graph=graph,
            sess=sess,
            actor_id=run_ask.author_id or "",
            encryption_key=self._key,
            user_message_id=user_msg.id if user_msg else "",
            user_seq=user_msg.seq if user_msg else 0,
            assistant_message_id=assistant.id if assistant else "",
            mode=mode,
            prompt=(user_msg.content if user_msg else run_ask.body),
            # A `ql` run **is** its query, and the query is the ask's body —
            # not the user row's content. On a re-run the reply's user row
            # still holds the natural-language question that was translated
            # once, and `ql-query` has no translate step to do it again, so
            # reading the row here would send English to the driver.
            query=(run_ask.body if mode == "ql" else None),
            answering=answering,
            language=params.get("language"),
            timeout_s=params.get("timeout_s"),
            parameters=params.get("parameters"),
            provider=provider,
            history=history,
            grounding=await load_grounding(db, graph.id) if th.flow_key != "modeller-generate" else None,
            global_model=await load_global_model(db, graph.id) if th.flow_key != "modeller-generate" else None,
            skills=skills,
            rules=rules,
            # The Graph's, then the agent's own focus (AG13).
            instructions=layered_instructions(
                graph.instructions,
                replay.get("instructions", agent.instructions if agent else ""),
            ),
            # The voice this run speaks with, fixed at open like the lens
            # (SO6). No agent is still a voice — the default one (SO3).
            soul=voice_for(agent.soul if agent else "", agent.soul_traits if agent else {}),
            agent=agent,
            envelope=Envelope.from_spec(agent.workflow_spec, effort=agent.effective_effort) if agent else None,
            run=th,
            # The lens this run froze at open ([GV26]) — read, never
            # recomposed ([GV8]). It is built once, here, so every step of
            # the run is checked against the same document, and a guardrail
            # tightened mid-run cannot change what this one was allowed to
            # rest on (docs/for-developers/modules/govern/spec.md).
            governor=Governor.for_run(th),
            # The Graph's pools, so a crossing can take a slot in one
            # ([CC8](docs/for-developers/modules/agents/features/concurrency-and-contention.md)).
            # Handed down on the run's vars for the same reason the governor
            # is: process state belongs to the thing that owns the process.
            pools=self._pools,
            # A load's stages hand each other records, and the plan carries
            # only counts and ids (LD21). The prologue settled these before
            # the run was queued, so this rebuilds the holder rather than
            # deciding anything (LD20).
            load=(
                LoadVars(
                    root=str(params.get("root") or ""),
                    model_id=str(params.get("model_id") or ""),
                    version_id=str(params.get("version_id") or ""),
                )
                if mode == "import"
                else None
            ),
        )
        return v, assistant

    async def _provider_for(self, db: AsyncSession, *, th: TaskRun):
        """The endpoint this run calls — what it recorded, else what its lens casts.

        An agent binds no provider
        ([PM1](docs/for-developers/modules/agents/features/providers-and-models.md)),
        so there is nothing to read off it: every run resolves the same way, and
        a Task's run resolves exactly as the ask that opened beside it would
        have ([PM14]).
        """
        provider = await endpoint_for_run(db, th=th)
        if provider is not None and th.model_version is None:
            # The version this run calls, kept beside the row id: the string is
            # what history keeps once the row is gone.
            th.model_version = provider.model_id
        return provider

    async def _skills_for(
        self, db: AsyncSession, *, agent: Agent | None, graph_id: str, replay: dict | None = None
    ) -> list[Skill | SkillAtVersion]:
        """The prose this run's prompts carry.

        An agent with no explicit binding gets every skill in the graph — the
        behaviour before agents existed, and what the seeded Explorer wants
        (docs/for-developers/modules/work/spec.md). An authored agent's empty list means *no skills*, and
        is distinguishable because seeded agents ship with none set.

        An eval replay that names ``skill_version_id`` offers that version of
        its skill in place of the head — the one way a draft reaches a prompt,
        and only on a run that is itself an eval.
        """
        # **Never a draft** — a skill reaches a step through its current
        # version, and a draft has not published one
        # ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        stmt = select(Skill).where(Skill.graph_id == graph_id, Skill.current_version_id.is_not(None))
        if agent is not None and agent.skill_ids:
            stmt = stmt.where(Skill.id.in_(list(agent.skill_ids)))
        skills: list[Skill | SkillAtVersion] = list((await db.execute(stmt.order_by(Skill.name))).scalars().all())
        version_id = (replay or {}).get("skill_version_id")
        version = await db.get(SkillVersion, version_id) if version_id else None
        if version is None:
            return skills
        subject = await db.get(Skill, version.skill_id)
        if subject is None:
            return skills
        swapped = [s for s in skills if s.id != subject.id]
        return sorted([*swapped, SkillAtVersion.of(subject, version)], key=lambda s: s.name)

    async def _rules_for(self, db: AsyncSession, *, run: TaskRun, graph_id: str) -> list[Rule]:
        """The statements always true in this run's scope.

        The order is fixed (skills/spec.md § 4): the install's rules, the
        Graph's invariants, then the working rules of the Project this run's
        Todo belongs to. A session ask belongs to no Project and is offered the
        install rules and the invariants alone.

        Only **active** rules — deactivating is how a rule stops applying, and
        the versions and past citations stay exactly where they are (RU4).
        """
        install = await self._rules.install(db, active_only=True)
        invariants = [*install, *await self._rules.invariants(db, graph_id=graph_id, active_only=True)]
        if not run.todo_id:
            return invariants
        todo = await db.get(Todo, run.todo_id)
        if todo is None or not todo.project_id:
            return invariants
        working = await self._rules.working(db, project_id=todo.project_id, active_only=True)
        return [*invariants, *working]

    async def _loop(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: TaskRun,
        wf,
        v: RunVars,
        assistant: SessionMessage | None,
        start_index: int,
    ) -> str:
        """Returns the metric status label: ok · clarify · cannot_answer · conversed · error.

        ``clarify`` is any pause for a person — a question, or a ``send`` step
        held on its approval.

        The list of steps is read from ``run_nodes`` each pass rather than
        from a static flow, because a *Plan* step appends to it mid-run.
        That is the whole difference between a planned flow and a fixed
        one — the loop cannot know its own length when it starts.
        """
        message_id = assistant.id if assistant else None
        i = start_index
        if start_index == 0 and th.parent_run_id is None:
            # A held policy's tokens a month, spent, keep a new run from starting.
            month = await self.access_gate.month_refusal(db, run=th, agent=v.agent)
            if month is not None:
                await self._drop_pending(db, th, message_id)
                await self._finish_failed(db, emitter, th, v, assistant, month, attempts=1)
                return "error"
        # The settled calls so far, as (function, args, output) — what *no progress* reads.
        recent: list[tuple[str, str, str]] = []
        while True:
            queued = await self._pending_rows(db, th, message_id)
            if i >= len(queued):
                break
            row = queued[i]
            step = Step(task_key=row.task_key, label=row.label, retry=_retry_for(wf, row, th.plan_snapshot))
            attempt = row.attempt
            # `${steps.x.y}` becomes the value it names, before anything reads
            # the args. The row is rewritten so the trace shows the query that
            # actually ran; the authored binding survives in `plan_snapshot`,
            # which is what a replay reads.
            row.args = resolve_bindings(row.args, {r.step_key: r.output or {} for r in queued[:i] if r.step_key})
            # A run stops on its token budget between steps — a child's budget is
            # its escrow — and the step it did not reach says why.
            if await self._out_of_budget(db, emitter, th, row, v, assistant):
                return "error"
            while True:
                row.status = RunStatus.running.value
                row.started_at = _now()
                await db.commit()
                await emitter.emit("step.started", _step_payload(row))
                ctx = TaskContext(db=db, manager=self._manager, emitter=emitter, step=row, runtime=self)
                if v.governor is not None:
                    v.governor.begin_step(row.id, row.task_key)
                try:
                    # Refused before dispatch when a policy layer does not allow it.
                    await self.access_gate.check(db, run=th, step_key=row.task_key, args=row.args, vars=v)
                    if await self._hold_for_send(db, emitter, th, row, v, i):
                        return "clarify"
                    with step_span(row, attempt):
                        out = await _dispatch(step.task_key, ctx, v)
                except CannotAnswer as cannot:
                    # A legitimate outcome: the run **succeeds**, and the
                    # remaining planned rows are dropped rather than left
                    # queued forever (promise #4).
                    reason, guardrail = self._refused_by(v, cannot)
                    row.status = RunStatus.succeeded.value
                    row.finished_at = _now()
                    row.detail = "cannot answer · outside this graph"
                    row.output = {"cannot_answer": reason, **cannot.exchange}
                    self._record(row, ctx, v)
                    await self._ledger_step(db, th, row, v)
                    await self._drop_pending(db, th, message_id)
                    filed = await self._file_request(db, th, v, reason, guardrail_id=guardrail)
                    if filed is not None:
                        row.output = {**row.output, "request_id": filed.id}
                    await db.commit()
                    await self._step_finished(db, emitter, th, row)
                    await self._finish_cannot_answer(db, emitter, th, v, assistant, reason)
                    return "cannot_answer"
                except Converse as conv:
                    # Small talk: the reply is the message, the run succeeds
                    # as *conversed*, and nothing planned after it runs (NL12).
                    row.status = RunStatus.succeeded.value
                    row.finished_at = _now()
                    row.detail = "small talk"
                    row.output = {"reply": conv.reply, "options": conv.options, **conv.exchange}
                    self._record(row, ctx, v)
                    await self._ledger_step(db, th, row, v)
                    await self._drop_pending(db, th, message_id)
                    await db.commit()
                    await self._step_finished(db, emitter, th, row)
                    await self._finish_conversed(db, emitter, th, v, assistant, conv.reply)
                    return "conversed"
                except NeedsInput as ni:
                    # Rounds are bounded (docs/for-developers/modules/agents/spec.md): past `max_clarifications`
                    # the step must decide rather than ask again. Never a
                    # silent loop, and never an unattended run asking a
                    # question nobody is there to answer.
                    limit = v.envelope.max_clarifications if v.envelope else 3
                    unattended = assistant is None or (
                        v.agent is not None and v.agent.effective_policy.get("unattended", False)
                    )
                    if unattended or th.clarifications >= limit:
                        reason = (
                            f"I still need to know: {ni.question}"
                            if unattended
                            else f"I asked {th.clarifications} time(s) and still cannot settle: {ni.question}"
                        )
                        row.status = RunStatus.succeeded.value
                        row.finished_at = _now()
                        row.detail = "cannot answer · unanswered question"
                        # Keep the exchange the step recorded (NL10): the
                        # prompt is the evidence for the question it asked.
                        row.output = {**(row.output or {}), "cannot_answer": reason, "question": ni.question}
                        if not unattended:
                            # The bound is named on the row, not left in the
                            # sentence: a plan's page counts how often each
                            # step ran out of rounds (the-library.md LB33).
                            row.output["bound"] = "max_clarifications"
                            row.output["clarifications"] = {"round": th.clarifications, "limit": limit}
                        self._record(row, ctx, v)
                        await self._ledger_step(db, th, row, v)
                        await self._drop_pending(db, th, message_id)
                        await db.commit()
                        await self._step_finished(db, emitter, th, row)
                        await emitter.emit("cannot_answer", {"reason": reason, "stage": step.task_key})
                        await self._finish_cannot_answer(db, emitter, th, v, assistant, reason)
                        await self._mark_task_needs_input(db, th, ni.question)
                        return "cannot_answer"
                    th.clarifications += 1
                    row.status = RunStatus.needs_input.value
                    row.finished_at = _now()
                    row.detail = f"needs input · {_awaiting_detail(ni.options)}"
                    row.output = {
                        **(row.output or {}),
                        "clarifications": {"round": th.clarifications, "limit": limit},
                    }
                    self._record(row, ctx, v)
                    if v.governor is not None:
                        # Held on a person, not settled: the resumed attempt is the row.
                        v.governor.end_step(row.id)
                    th.status = RunStatus.awaiting_input.value
                    # The cursor carries the question, not just where to resume:
                    # the attempt that continues the run records what it was
                    # answering, so each round of a multi-question clarification
                    # is auditable from its own step
                    # (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).
                    th.cursor = {"step": i, "question": ni.question}
                    await self._finish_needs_input(db, v, assistant, ni)
                    await db.commit()
                    await emitter.emit("step.needs_input", _step_payload(row))
                    await emitter.emit(
                        "clarification.requested",
                        {
                            "question": ni.question,
                            "options": ni.options,
                            "option_descriptions": ni.descriptions,
                            "round": th.clarifications,
                            "message": message_payload(assistant) if assistant else None,
                        },
                    )
                    return "clarify"
                except TaskFailure as failure:
                    row.status = RunStatus.failed.value
                    row.finished_at = _now()
                    row.detail = f"failed · {failure.short}"[:255]
                    row.error = {"cls": failure.cls, "cause": failure.cause, "message": failure.message}
                    if failure.raw:
                        row.error["raw"] = failure.raw[:2000]
                    self._record(row, ctx, v)
                    await self._ledger_step(db, th, row, v, failure=failure)
                    will_retry = failure.cls in step.retry.on and attempt < step.retry.max_attempts
                    await db.commit()
                    await self._step_finished(db, emitter, th, row)
                    if will_retry:
                        attempt += 1
                        delay_ms = step.retry.delay_ms(attempt - 1, random.random())
                        row = TaskRun(
                            graph_id=th.graph_id,
                            parent_run_id=th.id,
                            message_id=message_id,
                            seq=row.seq,
                            step_key=row.step_key,
                            task_key=step.task_key,
                            label=step.label,
                            args=row.args,
                            attempt=attempt,
                            status=RunStatus.queued.value,
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
                row.status = RunStatus.succeeded.value
                row.finished_at = _now()
                row.detail = out.detail[:255]
                row.input = out.input or row.input
                row.output = out.output or row.output
                row.tokens_in = out.tokens_in if out.tokens_in is not None else row.tokens_in
                row.tokens_out = out.tokens_out if out.tokens_out is not None else row.tokens_out
                self._record(row, ctx, v)
                await self._ledger_step(db, th, row, v)
                await db.commit()
                await self._step_finished(db, emitter, th, row)
                if _no_progress(recent, row):
                    failure = TaskFailure(
                        cls="bound",
                        cause="no_progress",
                        message=(
                            f"{row.task_key} ran {NO_PROGRESS_REPEATS} times in a row with the same arguments "
                            "and nothing new came back, so the run stopped."
                        ),
                        short="no progress",
                    )
                    await self._finish_failed(db, emitter, th, v, assistant, failure, attempts=attempt)
                    return "error"
                # A Plan step appends the rest of the run. The rows are written
                # and emitted **before** any of them starts, which is the
                # "this is what I'm about to do" moment plan-first buys.
                if ctx.planned:
                    await self._land_plan(db, emitter, th, v, message_id, ctx.planned, after=row.seq)
                    v.plan_steps = list(ctx.planned)
                break
            i += 1
        await self._finish_ok(db, emitter, th, v, assistant)
        return "ok"

    async def _hold_for_send(
        self, db: AsyncSession, emitter: Emitter, th: TaskRun, row: TaskRun, v: RunVars, i: int
    ) -> bool:
        """Hold a ``send`` step on an approval until a person decides; True when the run is now held.

        Nothing leaves Invana without a named person. The first pass that
        reaches the step asks the run's actor — else the Graph's owner — with
        the args frozen as the approval's payload, and records the approval id
        on the step row. A resumed pass runs the same row, so it reads the
        decision by that id: approved → the step dispatches; still pending →
        held again, no second request; declined or expired → ``blocked ·
        send_declined``, nothing sent. A disabled plugin is refused before
        anyone is asked.

        The hold is the clarification's suspension — row ``needs_input``, run
        ``awaiting_input``, a cursor naming the step — and not a clarification:
        an unattended run waits on its approver rather than ending.
        """
        manifest = load_plugins().task(row.task_key)
        if manifest is None or manifest.side_effect is not SideEffect.send:
            return False
        tool = tool_manifest(row.task_key)
        if tool is not None:
            await refuse_disabled(db, tool)
        gate = self.send_gate
        if gate is None:
            raise TaskFailure(
                cls="blocked",
                cause="approvals_unavailable",
                message="This process has no approvals inbox to hold a send step on; nothing was sent.",
                short="no approvals inbox",
            )
        approval_id = (row.output or {}).get("approval_id")
        if approval_id:
            status, who = await gate.decision(db, approval_id=approval_id)
            if status == "approved":
                return False
            if status in {"declined", "expired"}:
                raise TaskFailure(
                    cls="blocked",
                    cause="send_declined",
                    message=(
                        f"Declined by {who or 'its approver'}; nothing was sent."
                        if status == "declined"
                        else "The approval expired before anyone decided; nothing was sent."
                    ),
                    short="not sent",
                    evidence={"approval_id": approval_id, "status": status},
                )
        else:
            args = dict(row.args or {})
            subject = args.get("subject") or row.label or row.task_key
            approval_id = await gate.request(
                db,
                graph_id=th.graph_id,
                run_id=th.id,
                step_id=row.id,
                title=f"Send: {subject}",
                payload=args,
                approver_id=v.actor_id or (v.graph.created_by_id if v.graph else ""),
                deadline_s=SEND_APPROVAL_DEADLINE_S,
            )
            row.output = {**(row.output or {}), "approval_id": approval_id}
        row.status = RunStatus.needs_input.value
        row.finished_at = _now()
        row.detail = "awaiting approval"
        th.status = RunStatus.awaiting_input.value
        th.cursor = {"step": i, "approval": approval_id}
        await db.commit()
        await emitter.emit("step.needs_input", _step_payload(row))
        await emitter.emit("approval.requested", {"approval_id": approval_id, "step_id": row.id})
        return True

    # ── what a row spent, and what it recorded ────────────────────────────────

    @staticmethod
    def _record(row: TaskRun, ctx: TaskContext, v: RunVars) -> None:
        """Price the row and write its ``result.json`` — at every settle point.

        Both belong to the settled row rather than to the happy path: a step
        that failed, one that asked back and one that judged the ask out of
        scope each leave a document behind, because a reader opening any of
        them is asking the same question (SR38). ``cost_usd`` stays ``None``
        when the model has no published rate, which is *unknown* and not free
        (SR40 · observability.md OB4).

        Call it **after** ``finished_at`` and the tokens are set: the document
        is a snapshot of the row, not a promise about it.
        """
        row.cost_usd = cost_usd(v.provider, row.tokens_in, row.tokens_out)
        row.result = step_result(row, artifacts=ctx.artifacts)

    async def _ledger_step(
        self, db: AsyncSession, th: TaskRun, row: TaskRun, v: RunVars, *, failure: TaskFailure | None = None
    ) -> None:
        """Write the settled step's ledger row, in the step's own transaction.

        ``touched`` is the first participant the step engaged — else, for a
        model call, the model; for a delegation, the agent handed the work.
        The verdict is ``refused`` when the frozen lens refused the step
        something, or when it failed on a bound — naming which — and
        ``allowed`` otherwise, a plain failure included: the act happened.

        A spawn writes its own rows as it decides, so its step writes none here.
        """
        touch, lens_rule = v.governor.end_step(row.id) if v.governor is not None else (None, None)
        if row.task_key == "work.spawn_agent":
            if failure is not None and failure.cause == "policy_refused":
                # Refused before it ran, so the spawn wrote no row of its own.
                await ledger_acts.spawn_refused(
                    db,
                    run=th,
                    name=str((row.args or {}).get("name") or "Helper").strip(),
                    refused_by="grant",
                    rule=failure.message,
                    step_run_id=row.id,
                )
            return
        touched, line = (touch[0], ledger_acts.volume_line(touch[1])) if touch else ("", "")
        tokens = (row.tokens_in or 0) + (row.tokens_out or 0)
        if not touched and ledger_acts.layer_for(row.task_key) == "llm" and v.model_address:
            touched = v.model_address
        if row.task_key == "work.delegate":
            target = await db.get(Agent, str((row.args or {}).get("agent_id") or "")) if row.args else None
            touched = f"agent/{target.name}" if target else touched
            escrow = (row.input or {}).get("escrow")
            line = f"escrow {ledger_acts.tokens_line(escrow)}" if escrow else line
        if not line and tokens:
            line = f"{ledger_acts.tokens_line(tokens)} tokens"
        verdict, refused_by, rule = "allowed", None, ""
        if lens_rule is not None:
            verdict, refused_by, rule = "refused", "lens", lens_rule
        elif failure is not None:
            refused_by = (
                failure.evidence.get("refused_by")
                or _REFUSED_BY_CAUSE.get(failure.cause)
                or ("ceiling" if failure.cls == "bound" else None)
            )
            if refused_by:
                verdict, rule = "refused", failure.message
        manifest = tool_manifest(row.task_key)
        where = "tools queue" if manifest is not None and settings.executor == "procrastinate" else None
        await ledger_acts.step_settled(
            db,
            run=th,
            step=row,
            touched=touched,
            touched_line=line,
            verdict=verdict,
            refused_by=refused_by,
            rule=rule,
            where=where or ledger_acts.IN_PROCESS,
        )

    async def _out_of_budget(
        self, db: AsyncSession, emitter: Emitter, th: TaskRun, row: TaskRun, v: RunVars, m: SessionMessage | None
    ) -> bool:
        """End the run ``budget_declined`` when it has spent its token budget; True when it ended.

        Checked before each step, so a step is never started on tokens the run
        does not have. A child's budget is its escrow; a root's is what it
        froze at open, else its agent's. The step it did not reach is
        ``skipped`` and says why.
        """
        budget = await budget_of(db, th, v.agent)
        if budget is None:
            return False
        used = await spent(db, th)
        if used < budget:
            return False
        row.status = RunStatus.skipped.value
        row.detail = "not started · token budget spent"
        await db.commit()
        failure = TaskFailure(
            cls="bound",
            cause="budget_declined",
            message=f"This run spent {used} of its {budget} tokens, so it stopped before {row.label or row.task_key}.",
            short="budget spent",
            evidence={"budget": budget, "spent": used},
        )
        await self._finish_failed(db, emitter, th, v, m, failure, attempts=row.attempt)
        return True

    # ── the plan ──────────────────────────────────────────────────────────────

    async def _land_plan(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: TaskRun,
        v: RunVars,
        message_id: str | None,
        steps: list,
        *,
        after: int,
    ) -> None:
        th.plan_revision += 1
        payload = plan_payload(steps, source=v.plan_origin or "generated", version=th.plan_revision)
        th.plan_snapshot = payload
        th.plan_origin = v.plan_origin
        if v.flow_id:
            th.flow_id = v.flow_id
        await queue_plan_steps(db, run=th, message_id=message_id, steps=steps, start_seq=after + 1)
        await db.commit()
        await emitter.emit("plan.proposed" if th.plan_revision == 1 else "plan.revised", payload)

    async def _pending_rows(self, db: AsyncSession, th: TaskRun, message_id: str | None) -> list[TaskRun]:
        """The run's steps in order, newest attempt per position.

        Re-read each pass because *Plan* appends to this list mid-run.
        """
        stmt = select(TaskRun).where(TaskRun.parent_run_id == th.id)
        if message_id is not None:
            stmt = stmt.where(TaskRun.message_id == message_id)
        rows = list((await db.execute(stmt.order_by(TaskRun.seq, TaskRun.attempt))).scalars().all())
        latest: dict[int, TaskRun] = {}
        for row in rows:
            latest[row.seq] = row
        return [latest[seq] for seq in sorted(latest)]

    async def _drop_pending(self, db: AsyncSession, th: TaskRun, message_id: str | None) -> None:
        """Remove the rows a run will never reach.

        Used when *Understand* says the ask is outside the graph: leaving
        Translate · Validate · Execute queued forever would read as a run that
        stalled, when in fact it finished with an answer.
        """
        for row in await self._pending_rows(db, th, message_id):
            if row.status == RunStatus.queued.value:
                await db.delete(row)

    # ── settling the reply ────────────────────────────────────────────────────

    async def _finish_ok(
        self, db: AsyncSession, emitter: Emitter, th: TaskRun, v: RunVars, m: SessionMessage | None
    ) -> None:
        if m is None:
            await self._settle(db, emitter, th, v, None, RunStatus.succeeded)
            return
        sess = v.sess
        m.status = SessionMessageStatus.ok
        m.timeout_s = v.timeout_s
        if th.flow_key == "modeller-generate":
            assert v.proposal is not None and v.counts is not None
            m.via = v.via
            m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
            m.content = _model_summary(v.proposal.summary, v.counts)
        else:
            r = v.result
            assert r is not None
            m.source_query = v.query
            m.canvas_query = v.canvas_query
            m.query_language = r.query_language
            m.via = v.via or {"cypher": "Cypher", "gremlin": "Gremlin"}.get(r.query_language, r.query_language)
            m.rationale = v.rationale
            m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
            m.row_count = r.row_count
            m.execution_time_ms = r.execution_time_ms
            m.node_count = v.nodes
            m.edge_count = v.edges
            m.content = v.summary or ""
            if sess is not None:
                sess.node_count += v.nodes
                sess.edge_count += v.edges
        await self._settle(db, emitter, th, v, m, RunStatus.succeeded)

    async def _finish_cannot_answer(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: TaskRun,
        v: RunVars,
        m: SessionMessage | None,
        reason: str,
    ) -> None:
        """*Cannot answer* is an outcome, not a failure — the run succeeds.

        Studio styles it as deliberately not-an-answer (promise #4); making it
        a failure here would put it next to "the graph timed out", which is a
        different thing entirely.
        """
        if m is not None:
            m.status = SessionMessageStatus.ok
            m.content = reason
            m.via = v.via
            m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
            m.timeout_s = v.timeout_s
        v.summary = reason
        await self._settle(db, emitter, th, v, m, RunStatus.succeeded, outcome="cannot_answer")

    @staticmethod
    def _refused_by(v: RunVars, cannot: CannotAnswer) -> tuple[str, str | None]:
        """The reason to show, and the Graph guardrail behind a lens refusal if one holds the property.

        A property kept out or counted only is refused by the connector; the
        frozen lens names which Graph guardrail's target covers it, so the
        answer says *kept out by the guardrail "…"* and its request names that
        guardrail as the blocker.
        """
        refusal = cannot.refusal or {}
        prop = refusal.get("property_name")
        if refusal.get("code") not in _GUARDED or not prop or v.governor is None:
            return cannot.reason, None
        type_name = refusal.get("type_name") or ""
        access = _GUARDED[refusal["code"]]
        holding = [
            (parse_target(c["target"]), c)
            for c in v.governor.effective.contributors
            if c.get("scope") == "graph" and c.get("target") and c.get("access") == access
        ]
        # ``Deal.price`` names the property more closely than ``*.price``.
        holding = sorted(((t, c) for t, c in holding if t.covers(type_name, prop)), key=lambda pair: pair[0].any_type)
        if not holding:
            return cannot.reason, None
        contributor = holding[0][1]
        needs = f"{type_name}.{prop}" if type_name else prop
        name = contributor.get("name")
        return f'Cannot answer — this needs {needs}, kept out by the guardrail "{name}".', contributor["id"]

    async def _file_request(
        self, db: AsyncSession, th: TaskRun, v: RunVars, reason: str, *, guardrail_id: str | None
    ) -> Request | None:
        """File (or add to) the request an ask that ended *cannot answer* leaves behind.

        A guardrail's refusal files a ``guardrail`` request naming it; any other
        *cannot answer* files an ``unanswered`` one. Only for a run a person or
        an agent asked — an eval or a test replay is nobody's ask. Filing never
        fails the run.
        """
        if th.role == RunRole.evaluate.value or not (v.prompt or th.body):
            return None
        guardrail = await _lenses.get(db, guardrail_id) if guardrail_id else None
        asker = asker_of(
            triggered_by=th.triggered_by,
            author_id=th.author_id if th.author_kind == "user" else None,
            agent_id=th.agent_id,
            in_session=v.sess is not None,
        )
        return await _requests.file_quietly(
            db,
            graph_id=th.graph_id,
            kind=RequestKind.guardrail if guardrail is not None else RequestKind.unanswered,
            title=v.prompt or th.body or "",
            detail=reason,
            source=asker.source,
            asked_by_id=asker.asked_by_id,
            agent_id=asker.agent_id,
            run_id=th.id,
            session_id=v.sess.id if v.sess else None,
            guardrail=guardrail,
        )

    async def _finish_conversed(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: TaskRun,
        v: RunVars,
        m: SessionMessage | None,
        reply: str,
    ) -> None:
        """Small talk settles as a message, and as neither an answer nor a refusal.

        The outcome is ``conversed`` (CA8): calling it *answered* would claim a
        grounding it never had, and *cannot answer* is the refusal NL12 rules out.
        """
        if m is not None:
            m.status = SessionMessageStatus.ok
            m.content = reply
            m.via = v.via
            m.llm_time_ms = round(v.llm_ms) if v.llm_ms is not None else None
            m.timeout_s = v.timeout_s
        v.summary = reply
        await self._settle(db, emitter, th, v, m, RunStatus.succeeded, outcome="conversed")

    async def _finish_needs_input(self, db: AsyncSession, v: RunVars, m: SessionMessage | None, ni: NeedsInput) -> None:
        if m is None or v.sess is None:
            return
        m.status = SessionMessageStatus.ok
        m.content = ni.question
        # An empty list is not "no clarification" — it is a question the model
        # asked with nothing to pick from (a country, a name, a number), which
        # the user answers by typing. Collapsing it to NULL, as this once did,
        # left the reply indistinguishable from an ordinary answer on the
        # record: Studio then printed the question as a plain sentence with no
        # way to respond, under a run still saying "waiting on your answer".
        m.clarification_options = list(ni.options)
        m.clarification_descriptions = list(ni.descriptions) or None
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
        th: TaskRun,
        v: RunVars,
        m: SessionMessage | None,
        failure: TaskFailure,
        *,
        attempts: int,
    ) -> None:
        th.error = {"cls": failure.cls, "cause": failure.cause, "message": failure.message}
        if m is None:
            await emitter.emit("diagnosis", diagnose(failure, mode=v.mode, attempts=attempts))
            await self._settle(db, emitter, th, v, None, RunStatus.failed)
            return
        m.status = SessionMessageStatus.error
        m.source_query = v.query if v.query and th.flow_key != "modeller-generate" else m.source_query
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
        await self._settle(db, emitter, th, v, m, RunStatus.failed)

    async def _settle(
        self,
        db: AsyncSession,
        emitter: Emitter,
        th: TaskRun,
        v: RunVars,
        m: SessionMessage | None,
        status: RunStatus,
        outcome: str | None = None,
    ) -> None:
        sess = v.sess
        if sess is not None and m is not None:
            sess.last_status = m.status
            if not sess.title:
                sess.title = _title_from_text(v.prompt)
        th.status = status.value
        # How a reader would say it ended
        # (docs/for-developers/modules/ask/features/when-it-cannot-answer.md CA1). Distinct
        # from ``status``: a run that finished cleanly having found nothing is
        # *succeeded* and *cannot_answer*, and those are not the same claim.
        th.outcome = outcome or _OUTCOME_BY_STATUS.get(status.value)
        # The one reason it ended, recorded once, as it settles — never derived later.
        th.exit_reason = exit_reason_for(status.value, outcome=th.outcome, cause=(th.error or {}).get("cause"))
        th.finished_at = _now()
        # The run's own `result.json` — a roll-up of its tasks, written once the
        # outcome is known and never before (SR39). Its cost is the sum of the
        # rows that had one: a run with nothing priced has no cost, rather than
        # a total of the half it could price.
        nodes = await TaskRunQuerySet().nodes_of(db, run_id=th.id)
        priced = [node.cost_usd for node in nodes if node.cost_usd is not None]
        th.cost_usd = round(sum(priced), 6) if priced else None
        roll_up_run(th, nodes)
        th.result = run_result(th, nodes)
        if m is None and v.summary:
            # No session message carries the answer, so the run keeps it — what
            # a caller over this Graph's MCP server reads back.
            th.result["summary"] = v.summary
        await settle_escrow(db, th)
        rollup = await cost_rollup(db, run_id=th.id)
        agent_kwargs: dict = {"actor_type": ActorType.system, "actor_id": None}
        if th.agent_id and th.on_behalf_of_user_id:
            # An agent's own row names the human it acted for; a session reply
            # settled by the engine stays `system`, as it was.
            agent_kwargs = {
                "actor_kind": ActorKind.agent,
                "actor_id": th.agent_id,
                "on_behalf_of_user_id": th.on_behalf_of_user_id,
            }
        await emit_event(
            db,
            action=actions.THINKING_FINISH,
            target_kind=actions.TARGET_SESSION if sess is not None else actions.TARGET_THINKING,
            target_id=sess.id if sess is not None else th.id,
            graph_id=v.graph.id,
            task_id=th.todo_id,
            run_id=th.id,
            details={
                "run_id": th.id,
                "flow": th.flow_key,
                "status": status.value,
                "outcome": th.outcome,
                "duration_ms": span_ms(th.started_at, th.finished_at),
                "verdict": v.verdict,
                **rollup,
            },
            **agent_kwargs,
        )
        if status is RunStatus.succeeded:
            await self._count_after_import(db, th)
        await db.commit()
        if th.todo_id and status is RunStatus.succeeded and th.parent_run_id is None:
            await self._settle_task(db, th, v)
        await emitter.emit(
            "run.done",
            {
                "run_id": th.id,
                "status": status.value,
                "outcome": th.outcome,
                "verdict": v.verdict,
                "cost": rollup,
                "message": message_payload(m, th) if m else None,
            },
        )

    async def _mark_task_needs_input(self, db: AsyncSession, th: TaskRun, question: str) -> None:
        """An unattended agent's unanswered question moves the task, not the run.

        The run is finished — it said what it could not settle. The task
        goes ``needs_input`` so *the assignee's human* sees the question and
        can answer it, which is the only place an answer can come from
        (docs/for-developers/modules/work/spec.md, unattended).
        """
        if not th.todo_id:
            return
        from invana.apps.work.models import Task, TaskStatus

        task = await db.get(Task, th.todo_id)
        if task is None or not task.is_open:
            return
        task.status = TaskStatus.needs_input.value
        task.blocked_reason = question[:255]
        await emit_event(
            db,
            action=actions.TASK_NEEDS_INPUT,
            target_kind=actions.TARGET_TASK,
            target_id=task.id,
            graph_id=th.graph_id,
            project_id=task.project_id,
            task_id=task.id,
            run_id=th.id,
            actor_kind=ActorKind.agent if th.agent_id else ActorKind.system,
            actor_id=th.agent_id,
            on_behalf_of_user_id=th.on_behalf_of_user_id,
            details={"question": question[:500]},
        )
        await db.commit()

    async def _count_after_import(self, db: AsyncSession, th: TaskRun) -> None:
        """An import that wrote records leaves a count behind — the Growth line's point (MP14 · MP30).

        Only the root run of `model-import` or `bulk-load`, and only once it has
        succeeded. The snapshot never fails the run: the records already landed.
        """
        if th.parent_run_id is not None or (th.flow_key or "").split("@")[0] not in _IMPORT_PLAN_KEYS:
            return
        try:
            connector = await connector_for(db, th.graph_id)
        except LoadRefused:
            return
        try:
            await connector.connect()
            await CountSnapshotManager().take(
                db, graph_id=th.graph_id, connector=connector, source="import", source_id=th.id, degrees=True
            )
        except Exception:
            log.warning("No count after import run %s — the database did not answer", th.id, exc_info=True)
        finally:
            await connector.disconnect()

    async def _settle_task(self, db: AsyncSession, th: TaskRun, v: RunVars) -> None:
        """A finished task run posts a **result**, never `done`.

        This is the governance seam: the agent states what it found, a human
        accepts. Nothing here can move the task past ``review``.
        """
        from invana.apps.work.models import Task
        from invana.apps.work.schemas import TaskResultRequest
        from invana.apps.work.services import post_result

        task = await db.get(Task, th.todo_id)
        if task is None or not task.is_open:
            return
        emitted = [
            {"run_id": th.id, "kind": kind}
            for kind in (["graph"] if v.nodes or v.edges else ["table"] if v.result else [])
        ]
        await post_result(
            db,
            graph=v.graph,
            task=task,
            payload=TaskResultRequest(
                summary=v.summary or "",
                run_ids=[th.id],
                emitted=emitted,
            ),
            actor_kind=ActorKind.agent,
            actor_id=th.agent_id,
            actor_name=v.agent.name if v.agent else None,
            on_behalf_of_user_id=th.on_behalf_of_user_id,
            run_id=th.id,
        )
        await db.commit()

    # ── abnormal endings ──────────────────────────────────────────────────────

    async def _on_cancelled(self, run_id: str) -> None:
        emitter = Emitter(self._factory, run_id)
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            if th is None:
                return
            m = await db.get(SessionMessage, th.assistant_message_id) if th.assistant_message_id else None
            # Only the step that was running is "stopped"; the ones after it stay
            # queued so the list shows how far the run got (UC9).
            for row in await self._open_rows(db, th):
                if row.status == RunStatus.running.value:
                    row.status = RunStatus.stopped.value
                    row.finished_at = _now()
                    row.detail = "stopped"
            reason, stopped_by = self._cancelled.get(run_id, (ExitReason.stopped.value, None))
            th.status = RunStatus.cancelled.value
            th.outcome = "cancelled"
            th.exit_reason = reason
            th.finished_at = _now()
            await self._roll_up_run(db, th)
            await settle_escrow(db, th)
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
                details={"run_id": th.id, "exit_reason": reason},
            )
            if reason == ExitReason.stopped.value:
                await record_stop(db, run=th, stopped_by=stopped_by)
            else:
                await ledger_acts.run_ended(db, run=th, reason=reason)
            await db.commit()
            await emitter.emit(
                "run.cancelled",
                {"run_id": th.id, "status": th.status, "message": message_payload(m, th) if m else None},
            )

    async def _on_crash(self, run_id: str, exc: BaseException) -> None:
        emitter = Emitter(self._factory, run_id)
        failure = internal_failure(exc)
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            if th is None:
                return
            for row in await self._open_rows(db, th):
                row.status = RunStatus.failed.value
                row.finished_at = _now()
                row.detail = "failed · engine error"
                row.error = {"cls": "defect", "cause": "internal", "message": failure.message}
            th.status = RunStatus.failed.value
            th.outcome = "failed"
            th.exit_reason = ExitReason.failed.value
            th.finished_at = _now()
            th.error = {"cls": "defect", "cause": "internal", "message": failure.message, "raw": repr(exc)[:2000]}
            await self._roll_up_run(db, th)
            await settle_escrow(db, th)
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
                    "run.done",
                    {"run_id": th.id, "status": th.status, "message": message_payload(m, th) if m else None},
                )

    async def _fail_stale(self, db: AsyncSession, th: TaskRun) -> None:
        for row in await self._open_rows(db, th):
            row.status = RunStatus.failed.value
            row.finished_at = _now()
            row.detail = "failed · the engine restarted while this was running"
            row.error = {"cls": "defect", "cause": "internal", "message": "engine restarted"}
        th.status = RunStatus.failed.value
        th.outcome = "failed"
        th.exit_reason = ExitReason.failed.value
        th.finished_at = _now()
        th.error = {"cls": "defect", "cause": "internal", "message": "The engine restarted while this was running."}
        await self._roll_up_run(db, th)
        await settle_escrow(db, th)
        if th.assistant_message_id:
            m = await db.get(SessionMessage, th.assistant_message_id)
            if m is not None and m.status == SessionMessageStatus.running:
                m.status = SessionMessageStatus.error
                m.content = "The engine restarted while this was running."
                sess = await db.get(Session, m.session_id)
                if sess is not None:
                    sess.last_status = m.status

    async def _step_finished(self, db: AsyncSession, emitter: Emitter, th: TaskRun, row: TaskRun) -> None:
        """Emit a settled step, with its run's spend so far beside it.

        The assistant's live strip shows the run's tokens while it runs; the
        engine sums them here, from the same rows a settle rolls up, so the
        strip adds nothing.
        """
        spent_in, spent_out = run_tokens(th, await TaskRunQuerySet().nodes_of(db, run_id=th.id))
        await emitter.emit("step.finished", {**_step_payload(row), "run_tokens": spent_in + spent_out})

    async def _roll_up_run(self, db: AsyncSession, th: TaskRun) -> None:
        """How a run that finished outside ``_settle`` spent its time and tokens."""
        roll_up_run(th, await TaskRunQuerySet().nodes_of(db, run_id=th.id))

    async def _open_rows(self, db: AsyncSession, th: TaskRun) -> list[TaskRun]:
        return list(
            (
                await db.execute(
                    select(TaskRun).where(
                        TaskRun.parent_run_id == th.id,
                        TaskRun.status.in_([RunStatus.queued.value, RunStatus.running.value]),
                    )
                )
            ).scalars()
        )
