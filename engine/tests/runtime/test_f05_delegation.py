"""Delegation's bounds against a real Postgres: ceilings, escrow and *May delegate to*.

docs/for-developers/modules/agents/features/delegation.md — a spawn past a
ceiling is refused naming it and is a ``refused · ceiling`` ledger row; a
child's escrow comes out of its parent's remaining and its unspent part goes
back; ``never`` is refused and ``ask`` raises a delegation approval routed to
the target's owner.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from invana.activity.managers.ask_gate import ApprovalAskGate
from invana.activity.models import Approval
from invana.apps.agents.models import Agent
from invana.core.ledger.models import LedgerRow
from invana.plugins.core.work_write.tasks.delegate.run import _authorized
from invana.runtime import delegation
from invana.runtime.delegation import BoundExceeded
from invana.runtime.models import RunStatus, TaskRun

pytestmark = pytest.mark.asyncio


async def _agent(session, graph, user, name: str, **fields) -> Agent:
    agent = Agent(graph_id=graph.id, name=name, created_by_kind="user", created_by_id=user.id, **fields)
    session.add(agent)
    await session.flush()
    await session.refresh(agent, ["bound_skills"])
    return agent


async def _root(session, graph, user, agent: Agent, *, budget: int | None = None) -> TaskRun:
    run = TaskRun(
        graph_id=graph.id,
        agent_id=agent.id,
        on_behalf_of_user_id=user.id,
        author_id=user.id,
        status=RunStatus.running.value,
        params={"max_tokens_run": budget} if budget else {},
    )
    session.add(run)
    await session.flush()
    return run


async def _rows(session, graph, act: str) -> list[LedgerRow]:
    stmt = select(LedgerRow).where(LedgerRow.graph_id == graph.id, LedgerRow.act == act).order_by(LedgerRow.seq)
    return list((await session.execute(stmt)).scalars().all())


async def test_a_spawn_past_the_whole_tree_ceiling_is_refused_and_ledgered(session, graph, user):
    parent = await _agent(
        session, graph, user, "Route Auditor", policy={"can_spawn": True}, budget={"max_descendants": 1}
    )
    run = await _root(session, graph, user, parent)

    await delegation.spawn(session, parent=parent, run=run, name="Checker", instructions="", requested={})
    with pytest.raises(BoundExceeded) as refused:
        await delegation.spawn(session, parent=parent, run=run, name="Second", instructions="", requested={})

    assert refused.value.ceiling == "max_descendants" and refused.value.count == 1
    assert "at most 1 helpers" in str(refused.value)
    rows = await _rows(session, graph, "work.spawn_agent")
    assert [(r.verdict, r.refused_by) for r in rows] == [("allowed", None), ("refused", "ceiling")]
    assert rows[0].touched.startswith("agent/Checker") and rows[0].touched_line.startswith("depth 1")
    assert [link["kind"] for link in rows[1].actor_chain] == ["person", "agent"]


async def test_escrow_comes_out_of_the_parent_and_the_unspent_part_goes_back(session, graph, user):
    parent = await _agent(session, graph, user, "Coordinator")
    helper = await _agent(session, graph, user, "Hub Checker")
    root = await _root(session, graph, user, parent, budget=1000)
    step = TaskRun(graph_id=graph.id, parent_run_id=root.id, task_key="work.delegate", status="running")
    session.add(step)
    await session.flush()

    escrow = await delegation.take_escrow(session, parent_run=root, child_agent=helper, wanted=400)
    child = TaskRun(
        graph_id=graph.id, parent_run_id=step.id, agent_id=helper.id, escrow_tokens=escrow, status="running"
    )
    session.add(child)
    await session.flush()
    assert escrow == 400 and await delegation.remaining(session, root) == 600

    with pytest.raises(BoundExceeded, match="600 left"):
        await delegation.take_escrow(session, parent_run=root, child_agent=helper, wanted=700)

    spend = TaskRun(graph_id=graph.id, parent_run_id=child.id, task_key="llm.compose", tokens_in=100, tokens_out=50)
    session.add(spend)
    child.status = RunStatus.succeeded.value
    await session.flush()
    await delegation.settle_escrow(session, child)

    assert child.escrow_returned == 250
    assert await delegation.remaining(session, root) == 850
    (row,) = await _rows(session, graph, "escrow.return")
    assert row.touched == "agent/Hub Checker" and row.touched_line.startswith("250 returned")


async def test_never_is_refused_and_ask_raises_a_delegation_approval_to_the_owner(session, graph, user, other_user):
    target = await _agent(session, graph, other_user, "Fare Checker")
    caller = await _agent(session, graph, user, "Coordinator", policy={"may_delegate": {target.id: "never"}})

    with pytest.raises(BoundExceeded) as refused:
        await _authorized(None, None, delegation, caller=caller, target=target, body="check", wanted=None)
    assert refused.value.refused_by == "policy"

    caller.policy = {}
    assert delegation.may_delegate(caller, target) == delegation.ASK
    root = await _root(session, graph, user, caller)
    approval_id = await ApprovalAskGate().ask(
        session,
        kind="delegation",
        graph_id=graph.id,
        run_id=root.id,
        step_run_id=None,
        asked_by=[{"kind": "person", "id": user.id, "name": user.username}],
        wants=f"delegate to {target.name}",
        routed_reason="agent owner",
        approver_ids=await delegation.owner_of(session, target),
        payload={"from_agent_id": caller.id, "to_agent_id": target.id},
    )

    approval = await session.get(Approval, approval_id)
    assert (approval.kind, approval.subject_kind, approval.routed_reason) == ("delegation", "delegation", "agent owner")
    assert approval.approver_ids == [other_user.id]
    assert await ApprovalAskGate().verdict(session, approval_id=approval_id) == ("pending", "", None)
