"""The run page reads one tree, and the Runs list filters by tab and by exit.

A seeded root run with one delegated child: the Overview counts both agents and
every step in the tree, the Agents tab draws the child under the root with its
escrow, Stages groups steps by step key, and a pending budget ask reads as the
child's state and as *waiting on you*. The list's ``state`` and ``exit_reason``
filters, and a retune refused on a run that has not ended, close it out.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from invana.activity.managers.approvals import ApprovalManager
from invana.activity.models import Approval
from invana.activity.querysets.asks import pending_for
from invana.apps.agents.models import Agent
from invana.apps.govern.models import Lens, RunTouch  # noqa: F401 — tables for create_all
from invana.apps.work.models import Task as Todo  # noqa: F401
from invana.core.errors import ConflictError
from invana.core.ledger.models import LedgerRow
from invana.core.lists import ListParams
from invana.runtime import services
from invana.runtime.managers.run_pages import PendingAsk, RunPageManager
from invana.runtime.models import Emission, TaskRun

pytestmark = pytest.mark.asyncio

T0 = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


async def _agent(session, graph, name: str) -> Agent:
    agent = Agent(graph_id=graph.id, name=name)
    session.add(agent)
    await session.flush()
    return agent


def _step(root: TaskRun, *, seq: int, key: str, task_key: str, **kw) -> TaskRun:
    return TaskRun(
        graph_id=root.graph_id,
        parent_run_id=root.id,
        seq=seq,
        step_key=key,
        task_key=task_key,
        label=key,
        status=kw.pop("status", "succeeded"),
        started_at=T0 + timedelta(seconds=seq),
        finished_at=kw.pop("finished_at", T0 + timedelta(seconds=seq + 1)),
        **kw,
    )


async def _tree(session, graph, user):
    """A root run with two steps; the second delegated a child run with one step."""
    lead, helper = await _agent(session, graph, "lead"), await _agent(session, graph, "helper")
    root = TaskRun(
        graph_id=graph.id,
        ask_kind="nl",
        body="busiest routes",
        flow_key="nl-query",
        agent_id=lead.id,
        author_id=user.id,
        on_behalf_of_user_id=user.id,
        status="running",
        started_at=T0,
        params={"max_tokens_run": 50_000},
    )
    session.add(root)
    await session.flush()
    query = _step(root, seq=0, key="q", task_key="graph.read.query", output={"row_count": 214}, tokens_in=10)
    delegate = _step(root, seq=1, key="d", task_key="work.delegate", status="running", finished_at=None)
    session.add_all([query, delegate])
    await session.flush()
    child = TaskRun(
        graph_id=graph.id,
        parent_run_id=delegate.id,
        agent_id=helper.id,
        flow_key="nl-query",
        triggered_by="delegation",
        status="running",
        started_at=T0 + timedelta(seconds=2),
        escrow_tokens=15_000,
    )
    session.add(child)
    await session.flush()
    session.add(_step(child, seq=0, key="q", task_key="graph.read.query", output={"rows": [1, 2, 3]}, tokens_in=5))
    session.add(
        RunTouch(
            run_id=root.id,
            graph_id=graph.id,
            seq=1,
            step_key="q",
            address="graph_data/model/Airport",
            layer="graph_data",
            sublayer="model",
            participant="Airport",
            direction="in",
            volume={"rows": 214},
        )
    )
    session.add(
        Approval(
            graph_id=graph.id,
            subject_kind="run",
            subject_id=child.id,
            run_id=child.id,
            title="More tokens",
            kind="budget",
            wants="15k more tokens",
            payload={"tokens": 15_000},
            approver_ids=[user.id],
            deadline_at=T0 + timedelta(days=1),
        )
    )
    await session.flush()
    return root, child


class TestRunPage:
    async def test_overview_agents_and_stages_read_the_whole_tree(self, session, graph, user):
        root, child = await _tree(session, graph, user)
        asks = [PendingAsk.of(a) for a in await pending_for(session, graph_id=graph.id)]
        pages = RunPageManager()

        overview = await pages.overview(session, run=root, reader_id=user.id, asks=asks)
        assert overview.head.number is not None and overview.head.can_stop and not overview.head.can_rerun
        assert overview.head.max_tokens_run == 50_000 and overview.head.origin == "API"
        assert (overview.tiles.agents, overview.tiles.depth, overview.tiles.steps) == (2, 1, 3)
        assert overview.tiles.records_touched == 214 and overview.tiles.tokens == 15
        assert [w.for_you for w in overview.waiting] == [True]
        bars = {b.run_id: b for b in overview.agents_over_time}
        assert bars[child.id].state_line == "asking for 15k"

        agents = await pages.agents(session, run=root, asks=asks)
        node = next(n for n in agents.nodes if n.run_id == child.id)
        assert (node.parent_run_id, node.how, node.budget, node.depth) == (root.id, "delegated", 15_000, 1)
        assert {g.role for g in agents.roles} == {"lead", "helper"}

        stages = (await pages.stages(session, run=root)).stages
        assert [s.step_key for s in stages] == ["q", "d"]
        assert (stages[0].calls, stages[0].out_count, stages[0].line) == (2, 217, "→ 217 rows")
        assert stages[1].status == "running"
        # A step in the delegated child opens against the child's run.
        assert sorted(stages[0].run_of.values()) == sorted([root.id, child.id])

    async def test_an_ended_run_holds_no_ask(self, session, graph, user):
        root, child = await _tree(session, graph, user)
        root.status, child.status = "cancelled", "cancelled"
        await session.flush()
        assert await pending_for(session, graph_id=graph.id) == []
        assert await ApprovalManager().expire_due(session, now=T0) == 1
        [ask] = (await session.execute(select(Approval).where(Approval.run_id == child.id))).scalars().all()
        assert ask.status == "expired"

    async def test_assets_and_touched_read_what_was_recorded_and_no_more(self, session, graph, user):
        """A table that records only its row count and a Todo step still list as assets;
        a tree that recorded no tokens has none, and a model with no version is absent."""
        root, _ = await _tree(session, graph, user)
        session.add(Emission(run_id=root.id, seq=0, kind="table", payload={"title": "Delays", "rows": 42}))
        session.add(_step(root, seq=2, key="t", task_key="work.create_task", output=["not", "a", "document"]))
        session.add(_step(root, seq=3, key="m", task_key="nl.translate", tokens_in=7, tokens_out=3))
        await session.flush()
        pages = RunPageManager()

        assets = await pages.assets(session, run=root)
        assert [(a.name, a.size_line) for a in assets.items] == [("Delays", "42 rows")]
        touched = await pages.touched(session, run=root)
        assert {r.model for r in touched.llm} == {None}

        quiet = TaskRun(graph_id=graph.id, flow_key="ql-query", status="succeeded", started_at=T0)
        session.add(quiet)
        await session.flush()
        session.add(_step(quiet, seq=0, key="q", task_key="graph.read.query"))
        await session.flush()
        overview = await pages.overview(session, run=quiet, reader_id=user.id, asks=[])
        assert overview.head.tokens is None and overview.tiles.tokens is None

    async def test_a_reader_who_is_not_an_approver_is_not_asked(self, session, graph, user, other_user):
        root, _ = await _tree(session, graph, user)
        asks = [PendingAsk.of(a) for a in await pending_for(session, graph_id=graph.id)]
        overview = await RunPageManager().overview(session, run=root, reader_id=other_user.id, asks=asks)
        assert [w.for_you for w in overview.waiting] == [False]
        assert await pending_for(session, graph_id=graph.id, user_id=other_user.id) == []


class TestRunsList:
    async def _roots(self, session, graph, user):
        cases = (("succeeded", "served"), ("failed", "budget_declined"), ("running", None))
        for number, (status, reason) in enumerate(cases, start=1):
            # Numbered here: the numbering hook's raw SQL reads the default
            # schema, not this test's isolated one.
            session.add(
                TaskRun(
                    graph_id=graph.id,
                    flow_key="nl-query",
                    author_id=user.id,
                    status=status,
                    exit_reason=reason,
                    number=number,
                )
            )
        await session.flush()

    async def test_state_and_exit_filters(self, session, graph, user):
        await self._roots(session, graph, user)

        ended, _ = await services.list_runs(
            session, graph_id=graph.id, params=ListParams(sort="-created_at", filters={"state": ("ended",)})
        )
        assert sorted(r["status"] for r in ended) == ["failed", "succeeded"]

        not_served, _ = await services.list_runs(
            session, graph_id=graph.id, params=ListParams(sort="-created_at", filters={"exit_reason": ("not_served",)})
        )
        assert [r["exit_reason"] for r in not_served] == ["budget_declined"]
        assert not_served[0]["started_by_name"] == user.username and not_served[0]["origin"] == "API"

        # *From* filters by the same words a row says.
        api, _ = await services.list_runs(
            session, graph_id=graph.id, params=ListParams(sort="-created_at", filters={"origin": ("API",)})
        )
        explorer, _ = await services.list_runs(
            session, graph_id=graph.id, params=ListParams(sort="-created_at", filters={"origin": ("Explorer",)})
        )
        assert len(api) == 3 and explorer == []

    async def test_a_retune_of_a_run_still_going_is_refused(self, session, graph, user):
        run = TaskRun(graph_id=graph.id, flow_key="nl-query", ask_kind="nl", status="running")
        session.add(run)
        await session.flush()
        with pytest.raises(ConflictError):
            await services.rerun_run(
                session,
                graph=graph,
                run=run,
                versions="retune",
                actor_id=user.id,
                retune=services.Retune(max_tokens_run=10_000),
            )

    async def test_stopping_a_waiting_run_ends_it_stopped_and_names_who(self, session, graph, user):
        run = TaskRun(graph_id=graph.id, flow_key="nl-query", ask_kind="nl", status="awaiting_input", number=1)
        session.add(run)
        await session.flush()
        await services.cancel_waiting(session, run=run, stopped_by=user.id)
        assert (run.status, run.exit_reason) == ("cancelled", "stopped") and run.finished_at is not None
        rows = (await session.execute(select(LedgerRow).where(LedgerRow.run_id == run.id))).scalars().all()
        assert [(r.act, r.actor_user_id) for r in rows] == [("run.stop", user.id)]
