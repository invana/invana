"""Where a rule was cited — and what a citation still says afterwards.

Two cases: the count on a list row, and a citation resolving to the wording it
read rather than the wording the rule carries now.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import RuleManager
from invana.apps.skills.schemas import RuleCreate, RuleUpdate
from invana.core.auth.models import User
from invana.runtime.managers import RuleCitationManager
from invana.runtime.models import TaskRun

rules = RuleManager()
citations = RuleCitationManager()


async def _cite(session: AsyncSession, graph: Graph, version_ids: list[str]) -> None:
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
