"""The interpreter's acts land on the ledger, and runs end for one recorded reason.

docs/for-developers/modules/operate/features/the-ledger.md and
docs/for-developers/modules/agents/features/the-run-page.md — a settled step is a
row whose hash chains to the one before; a run that served ends ``served``; a
person stopping a run ends it ``stopped`` and every run under it
``parent_ended``. Stub tasks stand in for the LLM and the graph.
"""

from __future__ import annotations

import asyncio
from itertools import pairwise

import pytest
from sqlalchemy import select

from invana.core import ledger
from invana.core.ledger.models import GENESIS, LedgerRow
from invana.runtime import catalogue as task_registry
from invana.runtime import workflows
from invana.runtime.catalogue import Out
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.services import _queue_steps
from invana.runtime.workflows import Step, Workflow
from tests.runtime.test_runtime import _fresh, _open, _run, _tabular

pytestmark = pytest.mark.asyncio


@pytest.fixture
def stubs(monkeypatch):
    async def ok(ctx, v):
        v.result = _tabular()
        v.query = "MATCH (n) RETURN n"
        return Out(detail="stub ok")

    async def slow(ctx, v):
        await asyncio.sleep(30)
        return Out(detail="never")

    monkeypatch.setitem(task_registry.TASKS, "stub_ok", ok)
    monkeypatch.setitem(task_registry.TASKS, "stub_slow", slow)
    for wf in (
        Workflow("stub-ok", (Step("stub_ok", "Understand"), Step("answer.shape", "Project"))),
        Workflow("stub-slow", (Step("stub_slow", "Execute"),)),
    ):
        monkeypatch.setitem(workflows.WORKFLOWS, wf.key, wf)


async def _ledger(session, graph) -> list[LedgerRow]:
    stmt = select(LedgerRow).where(LedgerRow.graph_id == graph.id).order_by(LedgerRow.seq)
    return list((await session.execute(stmt.execution_options(populate_existing=True))).scalars().all())


async def test_a_settled_step_is_a_row_chained_to_the_one_before(session, session_factory, graph, user, stubs):
    runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
    _, _, th = await _open(session, graph, user, "stub-ok")
    await _run(runtime, th.id)

    run = await _fresh(session, TaskRun, th.id)
    assert (run.status, run.exit_reason) == ("succeeded", "served")
    rows = await _ledger(session, graph)
    steps = [r for r in rows if r.run_id == th.id and r.step_run_id]
    assert [r.act for r in steps] == ["stub_ok", "answer.shape"]
    assert all(r.verdict == "allowed" and r.actor_chain[0]["id"] == user.id for r in steps)
    assert steps[0].run_number == run.number
    assert rows[0].prev_hash == GENESIS
    assert all(later.prev_hash == earlier.hash for earlier, later in pairwise(rows))
    assert (await ledger.verify(session, graph.id)).ok


async def test_stopping_a_run_ends_it_stopped_and_its_child_parent_ended(session, session_factory, graph, user, stubs):
    runtime = TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x")
    _, _, th = await _open(session, graph, user, "stub-slow")
    (step,) = (await session.execute(select(TaskRun).where(TaskRun.parent_run_id == th.id))).scalars().all()
    child = TaskRun(
        graph_id=graph.id,
        parent_run_id=step.id,
        flow_key="stub-slow",
        ask_kind="nl",
        body="check it",
        triggered_by="delegation",
        on_behalf_of_user_id=user.id,
        escrow_tokens=1000,
    )
    session.add(child)
    await session.flush()
    _queue_steps(session, child, None, workflows.WORKFLOWS["stub-slow"])
    await session.commit()

    runtime.submit(th.id)
    runtime.submit(child.id)
    for _ in range(100):
        states = {(await _fresh(session, TaskRun, i)).status for i in (th.id, child.id)}
        if states == {RunStatus.running.value}:
            break
        await asyncio.sleep(0.05)
    assert await runtime.cancel(th.id, stopped_by=user.id) is True

    root, ended = await _fresh(session, TaskRun, th.id), await _fresh(session, TaskRun, child.id)
    assert (root.status, root.exit_reason) == ("cancelled", "stopped")
    assert (ended.status, ended.exit_reason, ended.escrow_returned) == ("cancelled", "parent_ended", 1000)
    acts = [(r.act, r.run_id) for r in await _ledger(session, graph)]
    assert ("run.stop", th.id) in acts and ("run.end", child.id) in acts and ("escrow.return", child.id) in acts
