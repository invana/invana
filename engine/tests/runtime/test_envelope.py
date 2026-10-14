"""A step travels as a ``TaskEnvelope`` and a worker rebuilds its world from the ids.

The rebuild runs against the real app database: a run row and one step row
committed, then ``run_envelope`` handed nothing but the envelope's JSON.
"""

from __future__ import annotations

import pytest

from invana.plugins.envelope import TaskEnvelope, out_from_json, out_to_json
from invana.plugins.sdk.errors import TaskFailure
from invana.plugins.worker import run_envelope
from invana.runtime.catalogue import Out
from invana.runtime.executor import RebuiltContexts
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import TaskRun

pytestmark = pytest.mark.asyncio

QUERY = "MATCH (a:Airport) RETURN count(a) AS n"


async def _run_with_one_step(session, graph, user) -> tuple[TaskRun, TaskRun]:
    run = TaskRun(
        graph_id=graph.id,
        author_id=user.id,
        ask_kind="ql",
        body=QUERY,
        workflow_key="ql-query",
        status="running",
    )
    session.add(run)
    await session.flush()
    step = TaskRun(
        graph_id=graph.id,
        parent_run_id=run.id,
        task_key="execute_graph_query",
        label="Run",
        attempt=2,
        status="running",
    )
    session.add(step)
    await session.commit()
    return run, step


class TestEnvelope:
    async def test_an_envelope_crosses_the_wire_and_keeps_its_idempotency_key(self):
        env = TaskEnvelope(
            run_id="r", node_id="n", attempt=1, plugin="invana.core.graph_read@0.0.0", task="execute_graph_query@1.0.0"
        )

        redelivered = TaskEnvelope.from_json(env.to_json())

        assert redelivered == env and redelivered.idempotency_key == "r:n:1"
        retried = TaskEnvelope.from_json(env.to_json().replace('"attempt": 1', '"attempt": 2'))
        assert retried.idempotency_key != env.idempotency_key
        assert out_from_json(out_to_json(Out(detail="3 rows", output={"rows": 3}))).output == {"rows": 3}

    async def test_a_worker_rebuilds_the_step_from_ids_alone(self, session, session_factory, graph, user):
        run, step = await _run_with_one_step(session, graph, user)
        seen: dict = {}

        async def task(ctx, v):
            seen.update(graph=v.graph.id, query=v.query, step=ctx.step.id, key=ctx.idempotency_key)
            ctx.step.detail = "ran on a worker"
            return Out(detail="ok", output={"rows": 1})

        wire = TaskEnvelope(
            run_id=run.id,
            node_id=step.id,
            attempt=step.attempt,
            plugin="invana.core.graph_read@0.0.0",
            task="execute_graph_query@1.0.0",
            args={"query": QUERY},
        ).to_json()
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")

        env = TaskEnvelope.from_json(wire)
        out = await run_envelope(env, contexts=RebuiltContexts(runtime), resolve=lambda _e: task)

        assert out.output == {"rows": 1}
        assert seen == {"graph": graph.id, "query": QUERY, "step": step.id, "key": f"{run.id}:{step.id}:2"}
        async with session_factory() as fresh:
            assert (await fresh.get(TaskRun, step.id)).detail == "ran on a worker"

    async def test_a_task_version_the_worker_does_not_carry_is_refused(self, session_factory):
        runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
        env = TaskEnvelope(run_id="missing", node_id="missing", attempt=1, plugin="", task="execute_graph_query@9.9.9")

        with pytest.raises(TaskFailure) as err:
            await run_envelope(env, contexts=RebuiltContexts(runtime))

        assert err.value.cls == "defect" and err.value.cause == "unknown_task_type"
