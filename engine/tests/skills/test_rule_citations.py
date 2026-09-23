"""Where a rule was offered, where it was cited, and what stays true afterwards.

Three cases: the count on a list row, a citation resolving to the wording it
read rather than the wording the rule carries now, and the pair RU7 exists for —
*never cited* told apart from *never offered*.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCreate, RuleUpdate
from invana.core.auth.models import User
from invana.runtime.managers import RuleCitationManager
from invana.runtime.managers.rule_citations import offered_rules
from invana.runtime.models import TaskRun

rules = RuleManager()
citations = RuleCitationManager()


async def _cite(
    session: AsyncSession, graph: Graph, version_ids: list[str], *, offered: list[str] | None = None
) -> None:
    root = TaskRun(graph_id=graph.id, ask_kind="nl", body="why", status="succeeded")
    session.add(root)
    await session.flush()
    session.add(
        TaskRun(
            graph_id=graph.id,
            parent_run_id=root.id,
            task_key="translate_thought",
            label="Translate",
            status="succeeded",
            finished_at=datetime.now(UTC),
            rules_offered=offered if offered is not None else version_ids,
            rules_cited=version_ids,
        )
    )
    await session.flush()


async def test_a_list_row_carries_how_often_the_rule_was_cited(session: AsyncSession, graph: Graph, user: User) -> None:
    cited = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="Used."), actor_id=user.id
    )
    never = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="Unused."), actor_id=user.id
    )
    await _cite(session, graph, [cited.current_version_id])
    await _cite(session, graph, [cited.current_version_id])

    counts = await citations.counts_for(session, graph_id=graph.id, rules=[cited, never])

    assert counts[cited.id] == 2
    # A rule nothing has used reads as zero, not as missing.
    assert counts[never.id] == 0


async def test_a_citation_reads_the_wording_it_was_offered(session: AsyncSession, graph: Graph, user: User) -> None:
    """RU4 · C5 — rewording and deactivating leave past citations alone."""
    rule = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Prices are in rupees."),
        actor_id=user.id,
    )
    await _cite(session, graph, [rule.current_version_id])

    await rules.update(session, rule=rule, payload=RuleUpdate(statement="Prices are in paise."), actor_id=user.id)
    await rules.set_active(session, rule=rule, active=False, actor_id=user.id)

    report = await citations.for_rule(session, rule=rule, graph_id=graph.id, limit=25)

    assert report.total == 1
    assert report.items[0].version == 1
    assert report.items[0].statement == "Prices are in rupees."


async def test_offered_and_cited_are_counted_apart_per_wording(session: AsyncSession, graph: Graph, user: User) -> None:
    """RU9 · RU10 — *never cited* is only a number when offers are counted too."""
    rule = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Prefer supplier names over ids."),
        actor_id=user.id,
    )
    v1 = rule.current_version_id
    await _cite(session, graph, [v1])
    # Offered and ignored — the gap the evidence loop reads.
    await _cite(session, graph, [], offered=[v1])
    await _cite(session, graph, [], offered=[v1])

    await rules.update(
        session,
        rule=rule,
        payload=RuleUpdate(statement="Prefer supplier names over ids in anything a person reads."),
        actor_id=user.id,
    )
    v2 = rule.current_version_id
    await _cite(session, graph, [v2])

    report = await citations.for_rule(session, rule=rule, graph_id=graph.id, limit=25)

    assert report.offered == 4
    assert report.total == 2
    # Newest wording first, each carrying its own count rather than a share of
    # the total — and the counts do not come from `items`.
    assert [(v.version, v.cited) for v in report.versions] == [(2, 1), (1, 1)]


async def test_a_rule_nobody_was_offered_reads_zero_on_both(session: AsyncSession, graph: Graph, user: User) -> None:
    """The negative: never offered and never cited are both `0`, and neither is missing."""
    rule = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="Unused."), actor_id=user.id
    )

    report = await citations.for_rule(session, rule=rule, graph_id=graph.id, limit=25)

    assert report.offered == 0
    assert report.total == 0
    assert [v.cited for v in report.versions] == [0]
    assert report.items == []


async def test_a_step_row_resolves_both_halves_to_statements(session: AsyncSession, graph: Graph, user: User) -> None:
    """RU12 — offered and cited each come back as the wording, beside the rule to open."""
    rule = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Prices are in rupees."),
        actor_id=user.id,
    )
    ignored = await rules.create(
        session,
        graph_id=graph.id,
        project_id=None,
        payload=RuleCreate(statement="Offered, never cited."),
        actor_id=user.id,
    )
    v1 = rule.current_version_id
    await _cite(session, graph, [v1], offered=[v1, ignored.current_version_id])
    step = await _steps_of(session, graph)

    resolved = await offered_rules(session, steps=step)

    offered = [resolved[i] for i in step[0].rules_offered]
    assert [r.statement for r in offered] == ["Prices are in rupees.", "Offered, never cited."]
    # The rule, not the version — a step row shows the statement and opens the board.
    assert [r.rule_id for r in offered] == [rule.id, ignored.id]

    # Rewording afterwards leaves the row saying what the step was actually given.
    await rules.update(session, rule=rule, payload=RuleUpdate(statement="Prices are in INR."), actor_id=user.id)
    again = await offered_rules(session, steps=step)
    assert again[v1].statement == "Prices are in rupees."


async def test_a_version_whose_rule_is_gone_resolves_to_nothing(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """The negative: an id that resolves to no statement is dropped, never drawn as an id."""
    rule = await rules.create(
        session, graph_id=graph.id, project_id=None, payload=RuleCreate(statement="Gone."), actor_id=user.id
    )
    v1 = rule.current_version_id
    await _cite(session, graph, [v1])
    await session.delete(rule)
    await session.flush()
    step = await _steps_of(session, graph)

    resolved = await offered_rules(session, steps=step)

    assert resolved == {}
    assert [resolved[i] for i in step[0].rules_cited if i in resolved] == []


async def _steps_of(session: AsyncSession, graph: Graph) -> list[TaskRun]:
    """The step rows of this graph — what a tree or a trace hands the resolver."""
    stmt = select(TaskRun).where(TaskRun.graph_id == graph.id, TaskRun.parent_run_id.is_not(None))
    return list((await session.execute(stmt)).scalars().all())
