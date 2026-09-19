"""Rules — offered discretely, cited by the step, and never deleted.

Five cases: the scope derived from one column, what a Project inherits, the
rewording that publishes, the inactive rule that stops being offered, and the
citation that still resolves after both.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.llm.grounding import render_rules
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCreate, RuleUpdate
from invana.apps.work.models import Project
from invana.core.auth.models import User
from invana.runtime.catalogue.contract import RunVars, cited_rule_version_ids, offered_rule_version_ids

rules = RuleManager()


async def _project(session: AsyncSession, graph: Graph, key: str = "q4") -> Project:
    project = Project(graph_id=graph.id, key=key, name="Q4")
    session.add(project)
    await session.flush()
    return project


async def test_scope_and_kind_are_read_off_one_column(session: AsyncSession, graph: Graph, user: User) -> None:
    """RU6 — `scope='graph', kind='working'` is not representable."""
    project = await _project(session, graph)
    invariant = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Prices are in rupees."),
        actor_id=user.id,
    )
    working = await rules.create(
        session,
        graph_id=graph.id,
        project_id=project.id,
        payload=RuleCreate(statement="Only Q4 suppliers count."),
        actor_id=user.id,
    )

    assert (invariant.scope, invariant.kind) == ("graph", "invariant")
    assert (working.scope, working.kind) == ("project", "working")
    assert invariant.version == 1
    assert invariant.statement == "Prices are in rupees."


async def test_a_project_sees_its_own_rules_and_the_graphs_invariants(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    project = await _project(session, graph)
    await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="Invariant."), actor_id=user.id
    )
    await rules.create(
        session, graph_id=graph.id, project_id=project.id, payload=RuleCreate(statement="Working."), actor_id=user.id
    )

    assert [r.statement for r in await rules.working(session, project_id=project.id)] == ["Working."]
    # The Graph's own list is unaffected by what a project adds.
    assert [r.statement for r in await rules.invariants(session, graph_id=graph.id)] == ["Invariant."]


async def test_rewording_publishes_and_the_old_wording_still_resolves(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    rule = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="First."), actor_id=user.id
    )
    v1 = rule.current_version_id

    await rules.update(session, rule=rule, payload=RuleUpdate(statement="Second."), actor_id=user.id)

    assert rule.version == 2
    assert rule.statement == "Second."
    # A step that cited v1 reads what it was offered, not what the rule says now.
    assert (await rules.get_version(session, rule=rule, version=1)).statement == "First."
    assert v1 != rule.current_version_id


async def test_deactivating_stops_the_offer_and_keeps_the_versions(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """RU4 · C6 — deactivating is not deleting, and not a version."""
    kept = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="Still true."), actor_id=user.id
    )
    dropped = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="No longer."), actor_id=user.id
    )
    cited_version_id = dropped.current_version_id

    await rules.set_active(session, rule=dropped, active=False, actor_id=user.id)

    offered = await rules.invariants(session, graph_id=graph.id, active_only=True)
    assert [r.id for r in offered] == [kept.id]
    # The rule and its versions are exactly where they were.
    assert len(await rules.list_versions(session, rule=dropped)) == 1
    assert (await rules.get_version(session, rule=dropped, version=1)).id == cited_version_id


async def test_rules_are_offered_discretely_and_cited_back_by_statement(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """RU3 — each rule is its own line with its own id; nothing is concatenated."""
    first = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Prices are in rupees."),
        actor_id=user.id,
    )
    second = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Weeks start on Monday."),
        actor_id=user.id,
    )
    v = RunVars(
        graph=graph,
        sess=None,
        actor_id=user.id,
        encryption_key="",
        user_message_id="",
        user_seq=0,
        assistant_message_id="",
        mode="nl",
        prompt="why",
        rules=[first, second],
    )

    assert render_rules(v.rules) == "1. Prices are in rupees.\n2. Weeks start on Monday."
    assert offered_rule_version_ids(v) == [first.current_version_id, second.current_version_id]
    # The model cites by statement; a statement it was never offered is dropped.
    assert cited_rule_version_ids(v, ["weeks start on monday.", "Something invented."]) == [second.current_version_id]
