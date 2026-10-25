"""Reading the ledger against a real Postgres
(docs/for-developers/modules/operate/features/the-ledger.md).

What is worth testing: the Rows filters, that a member sees their own acts and
the runs they can open while the rest is counted and not shown, that an export
carries each row's hash, and that an edited row breaks the chain.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import update

from invana.activity.managers.ledger import LedgerManager
from invana.apps.graphs.models import GraphMember
from invana.apps.sessions.models import Session
from invana.core import ledger
from invana.core.auth.models import User
from invana.core.errors import NotFoundError
from invana.core.ledger.models import LedgerRow
from invana.core.ledger.schemas import LEDGER_EXPORT_LIST, LEDGER_LIST
from invana.core.lists.params import parse_list_params
from invana.runtime.models import TaskRun

pytestmark = pytest.mark.asyncio

reader = LedgerManager()


def _params(**filters: str):
    return parse_list_params(LEDGER_LIST, {k: [v] for k, v in filters.items()})


@pytest_asyncio.fixture
async def member(session, graph) -> GraphMember:
    bo = User(email="bo@example.com", username="bo", password_hash="x", first_name="Bo")
    session.add(bo)
    await session.flush()
    row = GraphMember(graph_id=graph.id, user_id=bo.id, roles=["contributor"])
    session.add(row)
    await session.flush()
    return row


@pytest_asyncio.fixture
async def owner(session, graph, user) -> GraphMember:
    return await session.get(GraphMember, (graph.id, user.id))


@pytest_asyncio.fixture
async def rows(session, graph, user, member) -> dict[str, LedgerRow]:
    """Five acts: two in the owner's private run, one in the member's run, one each by hand."""
    own = Session(graph_id=graph.id, created_by_id=user.id)
    theirs = Session(graph_id=graph.id, created_by_id=member.user_id)
    session.add_all([own, theirs])
    await session.flush()
    private = TaskRun(graph_id=graph.id, session_id=own.id, status="succeeded", number=1)
    shared = TaskRun(graph_id=graph.id, session_id=theirs.id, status="succeeded", number=2)
    session.add_all([private, shared])
    await session.flush()
    person = {"kind": "person", "id": user.id, "name": "owner"}
    agent = {"kind": "agent", "id": "a-1", "name": "Route Auditor"}

    async def act(**kw) -> LedgerRow:
        return await ledger.record(session, graph_id=graph.id, **kw)

    return {
        "read": await act(
            actor_kind="agent",
            actor_agent_id="a-1",
            actor_chain=[person, agent],
            act="graph.read.query",
            layer="graph",
            touched="graph/Airport:LHR",
            verdict="allowed",
            run_id=private.id,
            run_number=1,
        ),
        "refused": await act(
            actor_kind="agent",
            actor_agent_id="a-1",
            actor_chain=[person, agent],
            act="graph.write.upsert",
            layer="graph",
            touched="graph/Fare",
            verdict="refused",
            refused_by="grant",
            rule="no writes to Fare",
            run_id=private.id,
            run_number=1,
        ),
        "shared": await act(
            actor_kind="agent",
            actor_agent_id="a-1",
            actor_chain=[{"kind": "person", "id": member.user_id, "name": "bo"}, agent],
            act="web.fetch",
            layer="web",
            touched="web/ba.com/fares",
            verdict="allowed",
            run_id=shared.id,
            run_number=2,
        ),
        "stop": await act(
            actor_kind="person",
            actor_user_id=user.id,
            actor_chain=[person],
            act="run.stop",
            layer="run",
            verdict="allowed",
        ),
        "mine": await act(
            actor_kind="person",
            actor_user_id=member.user_id,
            actor_chain=[{"kind": "person", "id": member.user_id, "name": "bo"}],
            act="approval.approve",
            layer="access",
            verdict="allowed",
        ),
    }


async def test_rows_filter_and_a_member_sees_only_their_own(session, graph, owner, member, rows):
    page = await reader.page(session, graph=graph, member=owner, params=_params(), applied=[])
    assert page.total == 5 and page.hidden == 0
    assert [r.seq for r in page.items] == [5, 4, 3, 2, 1]

    refused = await reader.page(session, graph=graph, member=owner, params=_params(preset="refused"), applied=[])
    assert [r.act for r in refused.items] == ["graph.write.upsert"]
    writes = await reader.page(session, graph=graph, member=owner, params=_params(act="graph.*"), applied=[])
    assert writes.total == 2
    by_agent = await reader.page(session, graph=graph, member=owner, params=_params(actor="agent:a-1"), applied=[])
    assert by_agent.total == 3

    seen = await reader.page(session, graph=graph, member=member, params=_params(), applied=[])
    assert {r.act for r in seen.items} == {"web.fetch", "approval.approve"}
    assert seen.hidden == 3
    with pytest.raises(NotFoundError):
        await reader.detail(session, graph=graph, member=member, row_id=rows["refused"].id)

    stats = await reader.stats(session, graph=graph, member=owner, since="today")
    assert stats.acts == 5 and stats.refused == 1 and stats.refused_by == {"grant": 1}
    assert {p.label: p.count for p in stats.presets}["Refused today"] == 1


async def test_by_actor_keys_models_by_address_and_refusals_count_the_world(session, graph, owner, user, rows):
    """A model row is keyed by its address and carries the step's tokens; a row
    naming no model is not a model. A ``world`` refusal has its own count, and a
    near-empty week gives the Acts tile no change."""
    agent = {"kind": "agent", "id": "a-1", "name": "Route Auditor"}
    chain = [{"kind": "person", "id": user.id, "name": "owner"}, agent]
    run = await session.get(TaskRun, rows["read"].run_id)
    step = TaskRun(graph_id=graph.id, parent_run_id=run.id, task_key="nl.translate", tokens_in=100, tokens_out=20)
    session.add(step)
    await session.flush()
    common = {"actor_kind": "agent", "actor_agent_id": "a-1", "actor_chain": chain, "run_id": run.id, "run_number": 1}
    await ledger.record(
        session, graph_id=graph.id, act="nl.translate", layer="llm", touched="llm/anthropic/claude-x",
        verdict="allowed", step_run_id=step.id, **common,
    )  # fmt: skip
    await ledger.record(
        session, graph_id=graph.id, act="nl.translate", layer="llm", touched="agent/Route Auditor",
        verdict="allowed", **common,
    )  # fmt: skip
    await ledger.record(
        session, graph_id=graph.id, act="web.fetch", layer="web", touched="web/fares.example.com",
        verdict="refused", refused_by="world", rule="world · web domains", **common,
    )  # fmt: skip

    read = await reader.actor(session, graph=graph, member=owner, actor="agent:a-1")
    assert [(r.key, r.a, r.b) for r in read.llm] == [("anthropic/claude-x", 1, 120)]
    assert {r.key: r.line for r in read.web} == {"ba.com": "", "fares.example.com": "world"}
    assert read.refused == 2 and read.refused_by == {"grant": 1, "world": 1}

    refusals = await reader.refusals(session, graph=graph, member=owner)
    assert (refusals.by_world, refusals.by_lens, refusals.by_grant) == (1, 0, 1)
    held = {r.refused_by: r for r in refusals.by_rule}
    assert held["world"].the_rule == "outside the world — web domains"
    assert held["grant"].the_rule == "no grant for graph/Fare — no writes to Fare"
    assert held["grant"].refused == 1 and held["grant"].rule == "no writes to Fare"

    earlier = datetime.now(UTC) - timedelta(days=2)
    for _ in range(7):
        await ledger.record(
            session, graph_id=graph.id, actor_kind="system", act="run.stop", layer="run", verdict="allowed", at=earlier
        )
    stats = await reader.stats(session, graph=graph, member=owner, since="today")
    assert stats.acts_7d_mean == 1.0 and stats.acts_change_pct is None


async def test_export_carries_hashes_and_a_tampered_row_breaks_the_chain(session, graph, owner, rows):
    name, media, chunks = await reader.export(session, graph=graph, member=owner, params=_params(), fmt="csv")
    text = "".join(chunks)
    assert name.endswith(".csv") and media == "text/csv"
    assert text.splitlines()[0].startswith("seq,at,actor_chain,act")
    assert rows["refused"].hash in text and "owner ▸ Route Auditor" in text
    await reader.export(session, graph=graph, member=owner, params=_params(preset="refused"), fmt="jsonl")
    page = await reader.exports(session, graph=graph, params=parse_list_params(LEDGER_EXPORT_LIST, {}), applied=[])
    assert page.total == 2 and [e.format for e in page.items] == ["jsonl", "csv"]
    assert page.items[1].rows == 5

    assert (await reader.integrity(session, graph=graph, full=True)).ok
    await session.execute(update(LedgerRow).where(LedgerRow.id == rows["shared"].id).values(touched="web/evil.com"))
    await session.refresh(rows["shared"])
    broken = await reader.integrity(session, graph=graph, full=True)
    assert not broken.ok and broken.broken_seq == 3
