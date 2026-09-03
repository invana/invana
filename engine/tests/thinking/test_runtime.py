"""The interpreter loop (RFC-055 § 9.2) against a real Postgres, with stub tasks
standing in for the LLM and the graph so the transitions — retry, needs-input +
resume, cancel — are what's under test, not the connectors."""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import select

from invana.graphs.schemas import QueryResponse
from invana.sessions import services as session_services
from invana.sessions.models import SessionMessage
from invana.sessions.schemas import SendMessage
from invana.thinking import services as thinking_services
from invana.thinking import tasks as task_registry
from invana.thinking import workflows
from invana.thinking.models import Thinking, ThinkingStep
from invana.thinking.runtime import ThinkingRuntime
from invana.thinking.stream import replay
from invana.thinking.tasks import NeedsInput, Out, TaskFailure
from invana.thinking.workflows import Retry, Step, Workflow

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
            raise NeedsInput(question="Which one?", options=["A", "B"], detail="which one?")
        v.result = _tabular()
        return Out(detail=f"answered with {v.prompt}")

    async def slow(ctx, v):
        await asyncio.sleep(30)
        return Out(detail="never")

    monkeypatch.setitem(task_registry.TASKS, "stub_ok", ok)
    monkeypatch.setitem(task_registry.TASKS, "stub_flaky", flaky)
    monkeypatch.setitem(task_registry.TASKS, "stub_ask", ask)
    monkeypatch.setitem(task_registry.TASKS, "stub_slow", slow)
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
        Workflow("stub-slow", (Step("stub_slow", "Execute"), project)),
    ):
        monkeypatch.setitem(workflows.WORKFLOWS, wf.key, wf)
    return calls


async def _open(session, graph, user, workflow_key: str):
    sess = await session_services.create_session(session, graph_id=graph.id, user_id=user.id, title="t")
    _, assistant, th = await thinking_services.open_turn(
        session, sess=sess, graph=graph, payload=SendMessage(content="hello", mode="ql"), actor_id=user.id
    )
    # Swap the ql workflow for the stub's, re-queuing its steps.
    wf = workflows.WORKFLOWS[workflow_key]
    th.workflow_key = wf.key
    for row in (await session.execute(select(ThinkingStep).where(ThinkingStep.thinking_id == th.id))).scalars():
        await session.delete(row)
    await session.flush()  # deletes before the re-insert of the same (seq, attempt) keys
    thinking_services._queue_steps(session, th, assistant.id, wf)
    await session.commit()
    return sess, assistant, th


async def _steps(session, thinking_id):
    # The runtime wrote through its own sessions — reload past this session's identity map.
    return list(
        (
            await session.execute(
                select(ThinkingStep)
                .where(ThinkingStep.thinking_id == thinking_id)
                .order_by(ThinkingStep.seq, ThinkingStep.attempt)
                .execution_options(populate_existing=True)
            )
        ).scalars()
    )


async def _fresh(session, model, id_):
    return await session.get(model, id_, populate_existing=True)


async def _run(runtime, thinking_id):
    runtime.submit(thinking_id)
    await runtime._tasks[thinking_id]


class TestRuntime:
    async def test_happy_path_settles_the_reply_and_the_stream(self, session, session_factory, graph, user, stub_tasks):
        runtime = ThinkingRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, assistant, th = await _open(session, graph, user, "stub-ok")
        await _run(runtime, th.id)

        steps = await _steps(session, th.id)
        assert [(s.label, s.status) for s in steps] == [("Understand", "succeeded"), ("Project", "succeeded")]
        assert steps[0].detail == "stub ok"
        assert (await _fresh(session, Thinking, th.id)).status == "succeeded"
        reply = await _fresh(session, SessionMessage, assistant.id)
        assert reply.status.value == "ok" and reply.content == "Returned 1 row." and reply.row_count == 1
        kinds = [e.kind for e in await replay(session, thinking_id=th.id, after=0)]
        assert kinds[0] == "thinking.started" and kinds[-1] == "thinking.done"
        assert kinds.count("step.finished") == 2

    async def test_transient_failure_retries_with_one_row_per_attempt(
        self, session, session_factory, graph, user, stub_tasks
    ):
        runtime = ThinkingRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, _, th = await _open(session, graph, user, "stub-flaky")
        await _run(runtime, th.id)

        steps = await _steps(session, th.id)
        execute = [s for s in steps if s.label == "Execute"]
        assert [(s.attempt, s.status) for s in execute] == [(1, "failed"), (2, "succeeded")]
        assert execute[0].error["cause"] == "timeout"
        kinds = [e.kind for e in await replay(session, thinking_id=th.id, after=0)]
        assert "step.retrying" in kinds and kinds[-1] == "thinking.done"
        assert stub_tasks["flaky"] == 2

    async def test_needs_input_parks_the_thinking_and_resume_continues_it(
        self, session, session_factory, graph, user, stub_tasks
    ):
        runtime = ThinkingRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        sess, assistant, th = await _open(session, graph, user, "stub-ask")
        await _run(runtime, th.id)

        th = await _fresh(session, Thinking, th.id)
        assert th.status == "awaiting_input" and th.cursor == {"step": 0}
        question = await _fresh(session, SessionMessage, assistant.id)
        assert question.content == "Which one?" and question.clarification_options == ["A", "B"]
        assert (await _steps(session, th.id))[0].status == "needs_input"

        sess = await _fresh(session, type(sess), sess.id)
        _, answer_reply = await thinking_services.resume_turn(session, sess=sess, thinking=th, answer="A")
        await session.commit()
        await _run(runtime, th.id)

        assert (await _fresh(session, Thinking, th.id)).status == "succeeded"
        reply = await _fresh(session, SessionMessage, answer_reply.id)
        assert reply.status.value == "ok"
        # The resumed Understand is attempt 2, under the new reply; the question keeps attempt 1.
        understand = [s for s in await _steps(session, th.id) if s.label == "Understand"]
        assert [(s.attempt, s.status, s.message_id == answer_reply.id) for s in understand] == [
            (1, "needs_input", False),
            (2, "succeeded", True),
        ]
        assert understand[1].detail == "answered with A"

    async def test_cancel_stops_the_running_step_and_leaves_the_rest_queued(
        self, session, session_factory, graph, user, stub_tasks
    ):
        runtime = ThinkingRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        _, assistant, th = await _open(session, graph, user, "stub-slow")
        runtime.submit(th.id)
        await asyncio.sleep(0.3)
        assert await runtime.cancel(th.id) is True

        steps = await _steps(session, th.id)
        assert [(s.label, s.status) for s in steps] == [("Execute", "stopped"), ("Project", "queued")]
        assert (await _fresh(session, Thinking, th.id)).status == "cancelled"
        reply = await _fresh(session, SessionMessage, assistant.id)
        assert reply.status.value == "stopped" and reply.content == "Stopped by you."
        kinds = [e.kind for e in await replay(session, thinking_id=th.id, after=0)]
        assert kinds[-1] == "thinking.cancelled"
