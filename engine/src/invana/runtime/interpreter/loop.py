"""The inline runtime — one ``asyncio`` task per run (docs/for-developers/modules/ask/spec.md ``inline`` adapter).

``TaskRuntime`` owns the interpreter loop of docs/for-developers/modules/ask/features/streaming-and-the-workflow.md:
for each step of
the workflow, mark the row running, run the task, and settle the row as
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
import logging
import random
import time

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from invana.apps.agents.envelope import Envelope
from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.llm.pricing import cost_usd
from invana.apps.sessions.models import Session, SessionMessage, SessionMessageStatus, SessionSurface
from invana.apps.sessions.querysets import SessionMessageQuerySet
from invana.apps.sessions.transcript import _friendly_query_error, _model_summary, _title_from_text
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.models import Rule, Skill
from invana.apps.work.models import Task as Todo
from invana.core.events import actions
from invana.core.events.models import ActorKind, ActorType
from invana.core.events.services import emit_event
from invana.core.telemetry.recorders import add_message_in_flight, record_session_message
from invana.runtime.catalogue import (
    CannotAnswer,
    LoadVars,
    NeedsInput,
    RunVars,
    TaskContext,
    TaskFailure,
    assemble_history,
    load_grounding,
)
from invana.runtime.contention import AgentAtCeiling, AgentSlots, GraphSlots, PoolSlots, Refused
from invana.runtime.delegation import cost_rollup, descendants
from invana.runtime.diagnosis import diagnose, internal_failure
from invana.runtime.executor import _dispatch
from invana.runtime.governing import Governor
from invana.runtime.interpreter.bindings import resolve as resolve_bindings
from invana.runtime.interpreter.payloads import (
    _HISTORY_TURNS,
    _OUTCOME_BY_STATUS,
    _awaiting_detail,
    _ms,
    _now,
    _retry_for,
    _step_payload,
    message_payload,
)
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.planning import plan_payload, queue_plan_steps
from invana.runtime.querysets import TaskRunQuerySet
from invana.runtime.results import run_result, step_result
from invana.runtime.services import endpoint_for_run
from invana.runtime.stream import Emitter, broadcaster
from invana.runtime.workflows import WORKFLOWS, Step

log = logging.getLogger(__name__)


class TaskRuntime:
    """Runs runs in-process. Created in the app lifespan; stubbed in route tests."""

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

    # ── lifecycle ─────────────────────────────────────────────────────────────

    async def startup(self) -> None:
        """Fail whatever was mid-flight when the process died — nothing streams forever.

        A database that hasn't had migration 28 applied yet has no ``runs``
        table; that must not take the whole API down, so the sweep logs the fix
        (``invana migrate``) and steps aside. The run routes will fail until
        the migration runs; everything else boots.
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
            return
        if stuck:
            log.warning("run: failed %d stale run(s) left over from a previous run", len(stuck))

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
            th.finished_at = _now()
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
            th.finished_at = _now()
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
        await emitter.emit(
            "run.queued",
            {
                "position": admission.position,
                "ceiling": admission.ceiling,
                "running": admission.running,
            },
        )
        while True:
            await asyncio.sleep(0.25)
            if th.id in self._slots.snapshot(th.graph_id)["running"]:
                await emitter.emit("run.started", {"waited": True})
                return True

    async def cancel(self, run_id: str) -> bool:
        """Stop a running run, and everything it delegated to.

        The cascade walks ``parent_run_id`` **down** (docs/for-developers/modules/work/spec.md):
        cancelling a parent while its children keep spending budget would make
        the stop button a lie.
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
        stopped = False
        for target in [*children, run_id]:
            task = self._tasks.get(target)
            if task is None or task.done():
                continue
            task.cancel()
            with contextlib.suppress(BaseException):
                await task
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
            log.exception("run %s crashed", run_id)
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
        emitter = Emitter(self._factory, run_id)
        started = time.perf_counter()
        async with self._factory() as db:
            th = await TaskRunQuerySet().get(db, run_id)
            if th is None or th.status not in {RunStatus.queued.value, RunStatus.running.value}:
                return
            # The Graph's ceiling, before anything else runs: a slot, a place in
            # the queue with a position, or a refusal naming the bound
            # (docs/for-developers/modules/agents/features/concurrency-and-contention.md).
            if not await self._await_slot(db, th, emitter):
                return
            # The ask is the run's own columns — there is no second row.
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

            # **Lenient, because a library plan is the normal case now**
            # (task-model-migration § 6.5). `workflow_key` on an import run is
            # `dataset-import@1`, which `WORKFLOWS` does not hold and is not
            # meant to: the three keys left in it are what a session opens
            # against, and they retire in M12. Subscripting here is what kept
            # ingestion running inline — the run raised `KeyError` before a
            # single node was dispatched.
            wf = WORKFLOWS.get(th.workflow_key)
            # A cursor exists only after a pause for input, so it is also how a
            # run knows it is *resuming*: this pass answers `question`, and
            # `prompt` below is the answer the user gave.
            cursor = th.cursor or {}
            start_index = int(cursor.get("step", 0))
            answering = cursor.get("question")
            params = run_ask.params or {}
            mode = run_ask.ask_kind
            surface = (
                (sess.surface.value if isinstance(sess.surface, SessionSurface) else str(sess.surface))
                if sess is not None
                else "task"
            )

            agent = await db.get(Agent, th.agent_id) if th.agent_id else None
            provider = await self._provider_for(db, th=run_ask)
            skills = await self._skills_for(db, agent=agent, graph_id=graph.id)
            rules = await self._rules_for(db, run=th, graph_id=graph.id)
            history = (
                assemble_history(
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
                grounding=await load_grounding(db, graph.id) if th.workflow_key != "modeller-generate" else None,
                skills=skills,
                rules=rules,
                instructions=graph.instructions or "",
                agent=agent,
                envelope=Envelope.from_spec(agent.workflow_spec, budget=agent.effective_budget) if agent else None,
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

            th.status = RunStatus.running.value
            th.started_at = _now()
            th.cursor = None
            await db.commit()
            add_message_in_flight(1, mode=mode, surface=surface)
            await emitter.emit(
                "run.started",
                {
                    "run_id": th.id,
                    "message_id": assistant.id if assistant else None,
                    "workflow": th.workflow_key,
                    "agent_id": th.agent_id,
                    "agent": agent.name if agent else None,
                    "task_id": th.todo_id,
                    "started_at": th.started_at,
                },
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

    async def _provider_for(self, db: AsyncSession, *, th: TaskRun):
        """The endpoint this run calls — what it recorded, else what its lens casts.

        An agent binds no provider
        ([PM1](docs/for-developers/modules/agents/features/providers-and-models.md)),
        so there is nothing to read off it: every run resolves the same way, and
        a Task's run resolves exactly as the ask that opened beside it would
        have ([PM14]).
        """
        return await endpoint_for_run(db, th=th)

    async def _skills_for(self, db: AsyncSession, *, agent: Agent | None, graph_id: str) -> list[Skill]:
        """The prose this run's prompts carry.

        An agent with no explicit binding gets every skill in the graph — the
        behaviour before agents existed, and what the seeded Explorer wants
        (docs/for-developers/modules/work/spec.md). An authored agent's empty list means *no skills*, and
        is distinguishable because seeded agents ship with none set.
        """
        # **Never a draft** — a skill reaches a step through its current
        # version, and a draft has not published one
        # ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        stmt = select(Skill).where(Skill.graph_id == graph_id, Skill.current_version_id.is_not(None))
        if agent is not None and agent.skill_ids:
            stmt = stmt.where(Skill.id.in_(list(agent.skill_ids)))
        return list((await db.execute(stmt.order_by(Skill.name))).scalars().all())

    async def _rules_for(self, db: AsyncSession, *, run: TaskRun, graph_id: str) -> list[Rule]:
        """The statements always true in this run's scope.

        The order is fixed (skills/spec.md § 4): the Graph's invariants, then
        the working rules of the Project this run's Todo belongs to. A session
        ask belongs to no Project and is offered the invariants alone.

        Only **active** rules — deactivating is how a rule stops applying, and
        the versions and past citations stay exactly where they are (RU4).
        """
        invariants = await self._rules.invariants(db, graph_id=graph_id, active_only=True)
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
        """Returns the metric status label: ok · clarify · cannot_answer · error.

        The list of steps is read from ``run_nodes`` each pass rather than
        from a static workflow, because a *Plan* step appends to it mid-run.
        That is the whole difference between a planned workflow and a fixed
        one — the loop cannot know its own length when it starts.
        """
        message_id = assistant.id if assistant else None
        i = start_index
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
            while True:
                row.status = RunStatus.running.value
                row.started_at = _now()
                await db.commit()
                await emitter.emit("step.started", _step_payload(row))
                ctx = TaskContext(db=db, manager=self._manager, emitter=emitter, step=row, runtime=self)
                try:
                    out = await _dispatch(step.task_key, ctx, v)
                except CannotAnswer as cannot:
                    # A legitimate outcome: the run **succeeds**, and the
                    # remaining planned rows are dropped rather than left
                    # queued forever (promise #4).
                    row.status = RunStatus.succeeded.value
                    row.finished_at = _now()
                    row.detail = "cannot answer · outside this graph"
                    row.output = {"cannot_answer": cannot.reason}
                    self._record(row, ctx, v)
                    await self._drop_pending(db, th, message_id)
                    await db.commit()
                    await emitter.emit("step.finished", _step_payload(row))
                    await self._finish_cannot_answer(db, emitter, th, v, assistant, cannot.reason)
                    return "cannot_answer"
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
                        row.output = {"cannot_answer": reason, "question": ni.question}
                        self._record(row, ctx, v)
                        await self._drop_pending(db, th, message_id)
                        await db.commit()
                        await emitter.emit("step.finished", _step_payload(row))
                        await emitter.emit("cannot_answer", {"reason": reason, "stage": step.task_key})
                        await self._finish_cannot_answer(db, emitter, th, v, assistant, reason)
                        await self._mark_task_needs_input(db, th, ni.question)
                        return "cannot_answer"
                    th.clarifications += 1
                    row.status = RunStatus.needs_input.value
                    row.finished_at = _now()
                    row.detail = f"needs input · {_awaiting_detail(ni.options)}"
                    self._record(row, ctx, v)
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
                    will_retry = failure.cls in step.retry.on and attempt < step.retry.max_attempts
                    await db.commit()
                    await emitter.emit("step.finished", _step_payload(row))
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
                await db.commit()
                await emitter.emit("step.finished", _step_payload(row))
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
        if v.task_plan_id:
            th.task_plan_id = v.task_plan_id
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
        th.finished_at = _now()
        # The run's own `result.json` — a roll-up of its tasks, written once the
        # outcome is known and never before (SR39). Its cost is the sum of the
        # rows that had one: a run with nothing priced has no cost, rather than
        # a total of the half it could price.
        nodes = await TaskRunQuerySet().nodes_of(db, run_id=th.id)
        priced = [node.cost_usd for node in nodes if node.cost_usd is not None]
        th.cost_usd = round(sum(priced), 6) if priced else None
        th.result = run_result(th, nodes)
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
                "workflow": th.workflow_key,
                "status": status.value,
                "outcome": th.outcome,
                "duration_ms": _ms(th.started_at, th.finished_at),
                "verdict": v.verdict,
                **rollup,
            },
            **agent_kwargs,
        )
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
                "message": message_payload(m) if m else None,
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
            th.status = RunStatus.cancelled.value
            th.outcome = "cancelled"
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
                details={"run_id": th.id},
            )
            await db.commit()
            await emitter.emit(
                "run.cancelled",
                {"run_id": th.id, "status": th.status, "message": message_payload(m) if m else None},
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
                    "run.done",
                    {"run_id": th.id, "status": th.status, "message": message_payload(m) if m else None},
                )

    async def _fail_stale(self, db: AsyncSession, th: TaskRun) -> None:
        for row in await self._open_rows(db, th):
            row.status = RunStatus.failed.value
            row.finished_at = _now()
            row.detail = "failed · the engine restarted while this was running"
            row.error = {"cls": "defect", "cause": "internal", "message": "engine restarted"}
        th.status = RunStatus.failed.value
        th.outcome = "failed"
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
