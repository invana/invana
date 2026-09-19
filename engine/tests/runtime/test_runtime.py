"""The interpreter loop (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md) against a real
Postgres, with stub tasks
standing in for the LLM and the graph so the transitions — retry, needs-input +
resume, cancel — are what's under test, not the connectors."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from invana.apps.graphs.schemas import QueryResponse
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.models import SessionMessage
from invana.apps.sessions.schemas import SendMessage
from invana.runtime import catalogue as task_registry
from invana.runtime import services as run_services
from invana.runtime import workflows
from invana.runtime.catalogue import NeedsInput, Out, TaskFailure
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import TaskRun
from invana.runtime.stream import replay
from invana.runtime.workflows import Retry, Step, Workflow

pytestmark = pytest.mark.asyncio


def _tabular() -> QueryResponse:
    return QueryResponse(
        result_type="tabular", query_language="cypher", rows=[{"a": 1}], execution_time_ms=3, row_count=1
    )


@pytest.fixture
def stub_tasks(monkeypatch):
    """Install stub tasks + workflows for the duration of a test."""
    calls: dict[str, int] = {}

    async def ok(ctx, v):
        calls["ok"] = calls.get("ok", 0) + 1
        v.result = _tabular()
        v.query = "MATCH (n) RETURN n"
        return Out(detail="stub ok")

    async def flaky(ctx, v):
        calls["flaky"] = calls.get("flaky", 0) + 1
        if calls["flaky"] == 1:
            raise TaskFailure(cls="transient", cause="timeout", message="slow", short="timeout")
        v.result = _tabular()
        return Out(detail="stub recovered")

    async def ask(ctx, v):
        calls["ask"] = calls.get("ask", 0) + 1
        if calls["ask"] == 1:
            raise NeedsInput(question="Which one?", options=["A", "B"])
        v.result = _tabular()
        return Out(detail=f"answered with {v.prompt}")

    async def ask_twice(ctx, v):
        """Two rounds of clarification on one run
        (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md), and it reports
        back what it was answering so the runtime's `answering` is under test."""
        n = calls["ask2"] = calls.get("ask2", 0) + 1
        if n <= 2:
            raise NeedsInput(question=f"Question {n}?", options=["A", "B"])
        v.result = _tabular()
        return Out(detail=f"answered with {v.prompt}", input={"answering": v.answering})

    async def ask_open(ctx, v):
        """A question with nothing to pick from — answered by typing, not clicking."""
        n = calls["ask_open"] = calls.get("ask_open", 0) + 1
        if n == 1:
            raise NeedsInput(question="Which country?", options=[])
        v.result = _tabular()
        return Out(detail=f"answered with {v.prompt}")

    async def slow(ctx, v):
        await asyncio.sleep(30)
        return Out(detail="never")

    async def offline(ctx, v):
        """Exactly what ``query_service`` raises when the connection isn't live."""
        raise HTTPException(status_code=503, detail={"error": "graph_not_active", "connection_id": "c1"})

    monkeypatch.setitem(task_registry.TASKS, "stub_ok", ok)
    monkeypatch.setitem(task_registry.TASKS, "stub_flaky", flaky)
    monkeypatch.setitem(task_registry.TASKS, "stub_ask", ask)
    monkeypatch.setitem(task_registry.TASKS, "stub_ask_twice", ask_twice)
    monkeypatch.setitem(task_registry.TASKS, "stub_ask_open", ask_open)
    monkeypatch.setitem(task_registry.TASKS, "stub_slow", slow)
    monkeypatch.setitem(task_registry.TASKS, "stub_offline", offline)
    project = Step("shape_for_canvas", "Project")
    for wf in (
        Workflow("stub-ok", (Step("stub_ok", "Understand"), project)),
        Workflow(
            "stub-flaky",
            (
                Step(
                    "stub_flaky",
                    "Execute",
                    retry=Retry(max_attempts=2, on=frozenset({"transient"}), initial_ms=1, jitter=False),
                ),
                project,
            ),
        ),
        Workflow("stub-ask", (Step("stub_ask", "Understand"), project)),
        Workflow("stub-ask-twice", (Step("stub_ask_twice", "Understand"), project)),
        Workflow("stub-ask-open", (Step("stub_ask_open", "Understand"), project)),
        Workflow("stub-slow", (Step("stub_slow", "Execute"), project)),
        Workflow("stub-offline", (Step("stub_offline", "Understand"), project)),
    ):
        monkeypatch.setitem(workflows.WORKFLOWS, wf.key, wf)
    return calls


async def _open(session, graph, user, workflow_key: str):
    sess = await SessionManager().create_session(session, graph=graph, user_id=user.id, title="t")
    _, assistant, th = await run_services.open_turn(
        session, sess=sess, graph=graph, payload=SendMessage(content="hello", mode="ql"), actor_id=user.id
    )
    # Swap the ql workflow for the stub's, re-queuing its steps.
    wf = workflows.WORKFLOWS[workflow_key]
    th.workflow_key = wf.key
    for row in (await session.execute(select(TaskRun).where(TaskRun.parent_run_id == th.id))).scalars():
        await session.delete(row)
    await session.flush()  # deletes before the re-insert of the same (seq, attempt) keys
    run_services._queue_steps(session, th, assistant.id, wf)
    await session.commit()
    return sess, assistant, th


async def _steps(session, run_id):
    # The runtime wrote through its own sessions — reload past this session's identity map.
    return list(
        (
            await session.execute(
                select(TaskRun)
                .where(TaskRun.parent_run_id == run_id)
                .order_by(TaskRun.seq, TaskRun.attempt)
                .execution_options(populate_existing=True)
            )
        ).scalars()
    )


async def _fresh(session, model, id_):
    return await session.get(model, id_, populate_existing=True)


async def _run(runtime, run_id):
    runtime.submit(run_id)
    await runtime._tasks[run_id]


class TestRuntime:
    async def test_happy_path_settles_the_reply_and_the_stream(self, session, session_factory, graph, user, stub_tasks):
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, assistant, th = await _open(session, graph, user, "stub-ok")
        await _run(runtime, th.id)

        steps = await _steps(session, th.id)
        assert [(s.label, s.status) for s in steps] == [("Understand", "succeeded"), ("Project", "succeeded")]
        assert steps[0].detail == "stub ok"
        assert (await _fresh(session, TaskRun, th.id)).status == "succeeded"
        reply = await _fresh(session, SessionMessage, assistant.id)
        assert reply.status.value == "ok" and reply.content == "Returned 1 row." and reply.row_count == 1
        kinds = [e.kind for e in await replay(session, run_id=th.id, after=0)]
        assert kinds[0] == "run.started" and kinds[-1] == "run.done"
        assert kinds.count("step.finished") == 2

    async def test_every_settled_row_records_a_result_json(self, session, session_factory, graph, user, stub_tasks):
        """SR38 · SR39 — the interpreter writes the document; no task does.

        The stubs are not catalogue entries, so nothing they recorded is a
        *declared* output — which is the filter doing its job rather than a gap.
        """
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, _, th = await _open(session, graph, user, "stub-ok")
        await _run(runtime, th.id)

        steps = await _steps(session, th.id)
        assert all(s.result for s in steps), "every settled row leaves a result.json"
        assert steps[0].result["status"] == "succeeded"
        assert steps[0].result["timing"]["duration_ms"] >= 0
        assert "outputs" not in steps[0].result

        run = await _fresh(session, TaskRun, th.id)
        assert [task["task_key"] for task in run.result["tasks"]] == [s.task_key for s in steps]
        assert run.result["status"] == "succeeded"
        # Nothing was priced and nothing spent tokens, so neither key is there.
        assert "cost_usd" not in run.result and "tokens" not in run.result

    async def test_transient_failure_retries_with_one_row_per_attempt(
        self, session, session_factory, graph, user, stub_tasks
    ):
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, _, th = await _open(session, graph, user, "stub-flaky")
        await _run(runtime, th.id)

        steps = await _steps(session, th.id)
        execute = [s for s in steps if s.label == "Execute"]
        assert [(s.attempt, s.status) for s in execute] == [(1, "failed"), (2, "succeeded")]
        assert execute[0].error["cause"] == "timeout"
        kinds = [e.kind for e in await replay(session, run_id=th.id, after=0)]
        assert "step.retrying" in kinds and kinds[-1] == "run.done"
        assert stub_tasks["flaky"] == 2

    async def test_needs_input_parks_the_thinking_and_resume_continues_it(
        self, session, session_factory, graph, user, stub_tasks
    ):
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        sess, assistant, th = await _open(session, graph, user, "stub-ask")
        await _run(runtime, th.id)

        th = await _fresh(session, TaskRun, th.id)
        # The cursor carries the question too, so the resumed attempt can record
        # what it answered.
        assert th.status == "awaiting_input"
        assert th.cursor == {"step": 0, "question": "Which one?"}
        question = await _fresh(session, SessionMessage, assistant.id)
        assert question.content == "Which one?" and question.clarification_options == ["A", "B"]
        assert (await _steps(session, th.id))[0].status == "needs_input"

        sess = await _fresh(session, type(sess), sess.id)
        _, answer_reply = await run_services.resume_turn(session, sess=sess, run=th, answer="A")
        await session.commit()
        await _run(runtime, th.id)

        assert (await _fresh(session, TaskRun, th.id)).status == "succeeded"
        reply = await _fresh(session, SessionMessage, answer_reply.id)
        assert reply.status.value == "ok"
        # The resumed Understand is attempt 2, under the new reply; the question keeps attempt 1.
        understand = [s for s in await _steps(session, th.id) if s.label == "Understand"]
        assert [(s.attempt, s.status, s.message_id == answer_reply.id) for s in understand] == [
            (1, "needs_input", False),
            (2, "succeeded", True),
        ]
        assert understand[1].detail == "answered with A"

    async def test_question_without_options_is_still_recorded_as_a_question(
        self, session, session_factory, graph, user, stub_tasks
    ):
        """Not every ask has a list behind it ("which country?"). The reply must
        still read as a *question* on the record — an empty option list, never
        NULL, which is what tells Studio the run is waiting on the composer
        rather than printing a plain sentence with no way to answer."""
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, assistant, th = await _open(session, graph, user, "stub-ask-open")
        await _run(runtime, th.id)

        assert (await _fresh(session, TaskRun, th.id)).status == "awaiting_input"
        question = await _fresh(session, SessionMessage, assistant.id)
        assert question.content == "Which country?"
        assert question.clarification_options == []
        assert (await _steps(session, th.id))[0].detail == "needs input · waiting on your answer"

    async def test_several_clarifying_rounds_stay_on_the_record(
        self, session, session_factory, graph, user, stub_tasks
    ):
        """A run may ask more than once. Each round is its own ask reply + answer
        on the same run, and its own Understand attempt — which is what the
        thread's timeline reads back to show every question and answer."""
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        sess, assistant, th = await _open(session, graph, user, "stub-ask-twice")
        await _run(runtime, th.id)

        th = await _fresh(session, TaskRun, th.id)
        assert th.cursor == {"step": 0, "question": "Question 1?"}
        sess = await _fresh(session, type(sess), sess.id)
        _, second_ask = await run_services.resume_turn(session, sess=sess, run=th, answer="A")
        await session.commit()
        await _run(runtime, th.id)

        th = await _fresh(session, TaskRun, th.id)
        assert th.status == "awaiting_input"
        assert th.cursor == {"step": 0, "question": "Question 2?"}
        sess = await _fresh(session, type(sess), sess.id)
        _, final = await run_services.resume_turn(session, sess=sess, run=th, answer="B")
        await session.commit()
        await _run(runtime, th.id)

        assert (await _fresh(session, TaskRun, th.id)).status == "succeeded"
        # One Understand attempt per round, the last one carrying what it answered.
        understand = [s for s in await _steps(session, th.id) if s.label == "Understand"]
        assert [(s.attempt, s.status) for s in understand] == [
            (1, "needs_input"),
            (2, "needs_input"),
            (3, "succeeded"),
        ]
        assert understand[2].input == {"answering": "Question 2?"}
        # The thread the timeline is rebuilt from: ask · answer · ask · answer · reply.
        first_ask = await _fresh(session, SessionMessage, assistant.id)
        second = await _fresh(session, SessionMessage, second_ask.id)
        assert (first_ask.content, first_ask.clarification_options) == ("Question 1?", ["A", "B"])
        assert (second.content, second.clarification_options) == ("Question 2?", ["A", "B"])
        answers = [
            m.content
            for m in (
                await session.execute(
                    select(SessionMessage)
                    .where(SessionMessage.session_id == sess.id, SessionMessage.role == "user")
                    .order_by(SessionMessage.seq)
                )
            ).scalars()
        ]
        assert answers == ["hello", "A", "B"]
        assert (await _fresh(session, SessionMessage, final.id)).status.value == "ok"

    async def test_cancel_stops_the_running_step_and_leaves_the_rest_queued(
        self, session, session_factory, graph, user, stub_tasks
    ):
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, assistant, th = await _open(session, graph, user, "stub-slow")
        runtime.submit(th.id)
        await asyncio.sleep(0.3)
        assert await runtime.cancel(th.id) is True

        steps = await _steps(session, th.id)
        assert [(s.label, s.status) for s in steps] == [("Execute", "stopped"), ("Project", "queued")]
        assert (await _fresh(session, TaskRun, th.id)).status == "cancelled"
        reply = await _fresh(session, SessionMessage, assistant.id)
        assert reply.status.value == "stopped" and reply.content == "Stopped by you."
        kinds = [e.kind for e in await replay(session, run_id=th.id, after=0)]
        assert kinds[-1] == "run.cancelled"

    async def test_inactive_connection_reads_as_a_diagnosis_not_an_engine_crash(
        self, session, session_factory, graph, user, stub_tasks
    ):
        """An HTTPException from any task is a fact about the Atlas, not a defect."""
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, assistant, th = await _open(session, graph, user, "stub-offline")
        await _run(runtime, th.id)

        th = await _fresh(session, TaskRun, th.id)
        assert th.status == "failed"
        assert th.error["cls"] == "blocked" and th.error["cause"] == "db_unreachable"
        reply = await _fresh(session, SessionMessage, assistant.id)
        assert reply.content == "The graph connection is not active right now."
        [diagnosis] = [e for e in await replay(session, run_id=th.id, after=0) if e.kind == "diagnosis"]
        assert diagnosis.payload["cause"] == "db_unreachable"
        assert {s["route"] for s in diagnosis.payload["suggestions"] if "route" in s} == {"settings/connection"}
