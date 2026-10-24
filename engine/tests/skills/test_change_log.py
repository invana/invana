"""The change log — a record's history, a compare of two versions, and the
events list narrowed to the writes that mint a version (change-log.md).

Five cases: a rule's history with its why, its author and what ran on each
wording; an agent's versions read back from its events; the change-log filter
on the events list; a skill's history with its why; and the refusals — a kind that is not versioned, a record
in another Graph, a version that does not exist.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers import ChangeLogManager
from invana.apps.agents.managers import AgentManager
from invana.apps.agents.schemas import AgentCreate, AgentUpdate
from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCreate, RuleUpdate, SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.core.errors import NotFoundError
from invana.core.events.querysets import EventQuerySet
from invana.core.events.querysets.event import EventFilter
from invana.runtime.managers import SkillDraftManager
from invana.runtime.models import TaskRun
from tests.skills.drawn import publish_drawn

changes = ChangeLogManager()
rules = RuleManager()
agents = AgentManager()
drafts = SkillDraftManager()


async def _step_offered(session: AsyncSession, graph: Graph, version_id: str, *, status: str, tokens: int) -> None:
    root = TaskRun(graph_id=graph.id, ask_kind="nl", body="why", status=status)
    session.add(root)
    await session.flush()
    session.add(
        TaskRun(
            graph_id=graph.id,
            parent_run_id=root.id,
            task_key="nl.translate",
            status=status,
            rules_offered=[version_id],
            tokens_in=tokens,
            tokens_out=tokens // 2,
        )
    )
    await session.flush()


async def test_a_rule_history_says_who_why_what_changed_and_what_ran(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    rule = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Prices are in USD."),
        actor_id=user.id,
    )
    await rules.update(
        session,
        rule=rule,
        payload=RuleUpdate(statement="Prices are in INR.", why="The ledger moved."),
        actor_id=user.id,
    )
    await _step_offered(session, graph, rule.current_version_id, status="succeeded", tokens=100)
    await _step_offered(session, graph, rule.current_version_id, status="failed", tokens=40)

    history = await changes.history(session, graph_id=graph.id, record_kind="rule", record_id=rule.id)

    assert [e.version for e in history.items] == ["2", "1"]
    latest, first = history.items
    assert latest.why == "The ledger moved."
    assert latest.actor_name == "owner"
    assert latest.action == "rule.publish"
    assert latest.summary == "statement changed"
    assert (latest.effect.basis, latest.effect.runs, latest.effect.failed) == ("pinned", 2, 1)
    assert (latest.effect.tokens_in, latest.effect.tokens_out) == (140, 70)
    assert first.summary == "the first version"
    assert first.why is None
    assert first.effect.runs == 0

    compare = await changes.compare(session, graph_id=graph.id, record_kind="rule", record_id=rule.id, a=None, b="2")
    assert compare.a == "1"
    assert [f.field for f in compare.fields] == ["statement"]
    assert "+Prices are in INR." in compare.fields[0].lines


async def test_an_agent_versions_are_read_back_from_its_events(session: AsyncSession, graph: Graph, user: User) -> None:
    agent = await agents.create_agent(
        session, graph=graph, payload=AgentCreate(name="Analyst", instructions="Be brief."), actor=user
    )
    await agents.update_agent(
        session, agent=agent, payload=AgentUpdate(instructions="Be thorough.", why="Answers were thin."), actor=user
    )
    await agents.update_agent(session, agent=agent, payload=AgentUpdate(description="Reads routes."), actor=user)

    history = await changes.history(session, graph_id=graph.id, record_kind="agent", record_id=agent.id)
    assert [e.version for e in history.items] == ["3", "2", "1"]
    assert history.items[1].why == "Answers were thin."
    assert history.items[1].summary == "instructions changed"

    compare = await changes.compare(session, graph_id=graph.id, record_kind="agent", record_id=agent.id, a="1", b="3")
    folded = {f.field: (f.before, f.after) for f in compare.fields}
    assert folded == {"instructions": ("Be brief.", "Be thorough."), "description": ("", "Reads routes.")}

    backwards = await changes.compare(session, graph_id=graph.id, record_kind="agent", record_id=agent.id, a="3", b="1")
    assert {f.field: (f.before, f.after) for f in backwards.fields}["instructions"] == ("Be thorough.", "Be brief.")


async def test_the_changes_filter_keeps_only_writes_that_mint_a_version(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    rule = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="One."), actor_id=user.id
    )
    await rules.set_active(session, rule=rule, active=False, actor_id=user.id)

    page = await EventQuerySet().list_page(session, filters=EventFilter(graph_id=graph.id, changes=True), cursor=None)
    assert [e.action for e in page.items] == ["rule.create"]

    narrowed = await EventQuerySet().list_page(
        session, filters=EventFilter(graph_id=graph.id, changes=True, actions=["rule.deactivate"]), cursor=None
    )
    assert narrowed.items == []


async def test_what_is_not_a_versioned_record_here_reads_as_absent(
    session: AsyncSession, graph: Graph, other_graph: Graph, user: User
) -> None:
    rule = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="One."), actor_id=user.id
    )

    with pytest.raises(NotFoundError):
        await changes.history(session, graph_id=graph.id, record_kind="board", record_id=rule.id)
    with pytest.raises(NotFoundError):
        await changes.history(session, graph_id=other_graph.id, record_kind="rule", record_id=rule.id)
    with pytest.raises(NotFoundError):
        await changes.compare(session, graph_id=graph.id, record_kind="rule", record_id=rule.id, a=None, b="9")


async def test_a_skill_history_carries_its_why_and_its_prose_diff(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Late suppliers", content="first", when_to_use="always"),
        actor_id=user.id,
        publish=True,
    )
    await publish_drawn(
        session, skill=skill, payload=SkillVersionPublish(content="second", why="Clearer."), actor_id=user.id
    )

    history = await changes.history(session, graph_id=graph.id, record_kind="skill", record_id=skill.id)

    assert [(e.version, e.why, e.summary) for e in history.items] == [
        # The prose changed, so the plan was redrawn from it.
        ("2", "Clearer.", "content changed · plan: +nl_translate · \u2212do-it"),
        ("1", None, "the first version"),
    ]
    assert history.items[0].effect.basis == "pinned"
