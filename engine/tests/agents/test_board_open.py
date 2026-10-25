"""The assistant opens a list: words become the list's own filters and its own count."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph, GraphMember
from invana.apps.llm.intent import list_words
from invana.core.auth.models import User
from invana.runtime.managers.board_open import BoardOpenManager
from invana.runtime.models import TaskRun


async def _auditor_runs(session: AsyncSession, graph: Graph, user: User) -> Agent:
    session.add(GraphMember(graph_id=graph.id, user_id=user.id))
    agent = Agent(graph_id=graph.id, key="route-auditor", name="Route Auditor", kind="authored", workflow_spec={})
    session.add(agent)
    await session.flush()
    for status in ("failed", "failed", "succeeded"):
        session.add(TaskRun(graph_id=graph.id, agent_id=agent.id, status=status, ask_kind="nl", body="audit"))
    session.add(TaskRun(graph_id=graph.id, status="failed", ask_kind="nl", body="someone else"))
    await session.flush()
    return agent


async def test_words_open_runs_with_the_lists_own_filters_and_count(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    agent = await _auditor_runs(session, graph, user)
    words = list_words(["list: runs", "agent: route auditor", "status: failed", "since: this month"])

    link = await BoardOpenManager().open(session, graph=graph, actor_id=user.id, list_key="runs", words=words)

    assert link.path == "/agents/runs"
    assert link.params == {"f.agent_id": agent.id, "f.status": "failed", "f.since": "30d"}
    assert link.total == 2
    assert {c["field"]: c["label"] for c in link.chips} == {
        "agent_id": "Route Auditor",
        "status": "failed",
        "since": "last 30 days",
    }
    assert link.unresolved == []


async def test_an_unknown_name_is_said_and_the_other_filters_kept(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await _auditor_runs(session, graph, user)
    words = {"agent": "Route Auditer", "status": "failed", "origin": "by carrier pigeon"}

    link = await BoardOpenManager().open(session, graph=graph, actor_id=user.id, list_key="runs", words=words)

    assert link.params == {"f.status": "failed"}
    assert link.total == 3
    assert [u["field"] for u in link.unresolved] == ["agent", "origin"]
    assert 'No agent named "Route Auditer".' in link.sentence


async def test_an_agent_in_another_graph_does_not_resolve(session: AsyncSession, graph: Graph, user: User) -> None:
    other = Graph(slug="elsewhere", name="Elsewhere", created_by_id=user.id, setup_state={})
    session.add(other)
    await session.flush()
    await _auditor_runs(session, other, user)

    link = await BoardOpenManager().open(
        session, graph=graph, actor_id=user.id, list_key="runs", words={"agent": "Route Auditor"}
    )

    assert link.params == {}
    assert link.unresolved[0]["field"] == "agent"
