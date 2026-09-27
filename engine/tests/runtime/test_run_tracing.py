"""A run's spans — against a real Postgres, with stub tasks and a real SDK tracer.

The runtime opens spans through ``invana.core.telemetry.spans``; the fixture
points that at a local ``TracerProvider`` with an in-memory exporter, so what is
asserted is what an OTLP exporter would have been handed.
"""

from __future__ import annotations

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode
from sqlalchemy import select

from invana.apps.graphs.schemas import QueryResponse
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.schemas import SendMessage
from invana.core.telemetry import spans
from invana.runtime import catalogue as task_registry
from invana.runtime import services as run_services
from invana.runtime import workflows
from invana.runtime.catalogue import CannotAnswer, Out, TaskFailure
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.workflows import Step, Workflow

pytestmark = pytest.mark.asyncio


def _tabular() -> QueryResponse:
    return QueryResponse(
        result_type="tabular", query_language="cypher", rows=[{"a": 1}], execution_time_ms=3, row_count=1
    )


@pytest.fixture
def exporter(monkeypatch) -> InMemorySpanExporter:
    exp = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exp))
    monkeypatch.setattr(spans._trace, "get_tracer", lambda *a, **k: provider.get_tracer("test.invana.runs"))
    return exp


@pytest.fixture
def stub_tasks(monkeypatch):
    async def ok(ctx, v):
        v.result = _tabular()
        return Out(detail="stub ok")

    async def cannot(ctx, v):
        raise CannotAnswer(reason="This graph holds no weather.")

    async def broken(ctx, v):
        raise TaskFailure(cls="permanent", cause="bad", message="broken", short="broken")

    async def delegate(ctx, v):
        # What `delegate` does: a child run whose parent is this step, submitted from inside it.
        child = TaskRun(graph_id=ctx.step.graph_id, parent_run_id=ctx.step.id, workflow_key="stub-ok", role="execute")
        ctx.db.add(child)
        await ctx.db.flush()
        ctx.db.add(
            TaskRun(
                graph_id=child.graph_id,
                parent_run_id=child.id,
                seq=0,
                step_key="stub_ok",
                task_key="stub_ok",
                label="Understand",
                status=RunStatus.queued.value,
            )
        )
        await ctx.db.commit()
        ctx.runtime.submit(child.id)
        await ctx.runtime._tasks[child.id]
        v.result = _tabular()
        return Out(detail="delegated")

    for key, fn in {"stub_ok": ok, "stub_cannot": cannot, "stub_broken": broken, "stub_delegate": delegate}.items():
        monkeypatch.setitem(task_registry.TASKS, key, fn)
    for wf in (
        Workflow("stub-ok", (Step("stub_ok", "Understand"), Step("stub_ok", "Execute"))),
        Workflow("stub-cannot", (Step("stub_cannot", "Understand"),)),
        Workflow("stub-broken", (Step("stub_broken", "Execute"),)),
        Workflow("stub-delegate", (Step("stub_delegate", "Delegate"),)),
    ):
        monkeypatch.setitem(workflows.WORKFLOWS, wf.key, wf)


async def _open(session, graph, user, workflow_key: str) -> TaskRun:
    sess = await SessionManager().create_session(session, graph=graph, user_id=user.id, title="t")
    _, assistant, th = await run_services.open_turn(
        session, sess=sess, graph=graph, payload=SendMessage(content="hello", mode="ql"), actor_id=user.id
    )
    wf = workflows.WORKFLOWS[workflow_key]
    th.workflow_key = wf.key
    for row in (await session.execute(select(TaskRun).where(TaskRun.parent_run_id == th.id))).scalars():
        await session.delete(row)
    await session.flush()
    run_services._queue_steps(session, th, assistant.id, wf)
    await session.commit()
    return th


async def _run(session_factory, run_id: str) -> None:
    runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
    runtime.submit(run_id)
    await runtime._tasks[run_id]


def _named(exporter, name):
    return [s for s in exporter.get_finished_spans() if s.name == name]


class TestRunSpans:
    async def test_a_run_is_a_span_and_each_step_its_child(
        self, session, session_factory, graph, user, stub_tasks, exporter
    ):
        th = await _open(session, graph, user, "stub-ok")
        await _run(session_factory, th.id)

        [run] = _named(exporter, "invana.run")
        steps = _named(exporter, "invana.run.step")
        assert run.attributes["invana.run_id"] == th.id
        assert run.attributes["invana.principal"] == ("agent" if th.agent_id else "user")
        assert run.attributes.get("invana.agent_id") == th.agent_id
        assert run.attributes["invana.outcome"] == "ok"
        assert len(steps) == 2
        assert all(s.parent.span_id == run.context.span_id for s in steps)
        assert all(s.attributes["invana.outcome"] == "ok" for s in steps)

    async def test_cannot_answer_is_an_outcome_not_an_error(
        self, session, session_factory, graph, user, stub_tasks, exporter
    ):
        th = await _open(session, graph, user, "stub-cannot")
        await _run(session_factory, th.id)

        [step] = _named(exporter, "invana.run.step")
        [run] = _named(exporter, "invana.run")
        assert step.attributes["invana.outcome"] == "cannot_answer"
        assert step.status.status_code != StatusCode.ERROR
        assert run.attributes["invana.outcome"] == "cannot_answer"

    async def test_a_failed_step_is_an_error(self, session, session_factory, graph, user, stub_tasks, exporter):
        th = await _open(session, graph, user, "stub-broken")
        await _run(session_factory, th.id)

        [step] = _named(exporter, "invana.run.step")
        assert step.attributes["invana.outcome"] == "failed"
        assert step.status.status_code == StatusCode.ERROR
        assert _named(exporter, "invana.run")[0].attributes["invana.outcome"] == "error"

    async def test_a_delegated_run_links_to_its_parent_run(
        self, session, session_factory, graph, user, stub_tasks, exporter
    ):
        th = await _open(session, graph, user, "stub-delegate")
        await _run(session_factory, th.id)
        assert (await session.get(TaskRun, th.id, populate_existing=True)).status == "succeeded"

        runs = {s.attributes["invana.run_id"]: s for s in _named(exporter, "invana.run")}
        parent = runs.pop(th.id)
        [child] = runs.values()
        [delegating] = [
            s for s in _named(exporter, "invana.run.step") if s.attributes["invana.task_key"] == "stub_delegate"
        ]
        assert child.parent.span_id == delegating.context.span_id
        assert [link.context.span_id for link in child.links] == [parent.context.span_id]
