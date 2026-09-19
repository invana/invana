"""The version diff, and the two usage cuts the Usage tab draws.

Four cases: what v1 diffs against, what a rewrite reports, the breakdown by
agent and outcome, and the floor below which a count is not a ratio.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.runtime.managers import SkillUsageManager
from invana.runtime.managers.skill_usage import MIN_OFFERS_TO_READ
from invana.runtime.models import TaskRun

skills = SkillManager()
usage = SkillUsageManager()


async def _run(session: AsyncSession, graph: Graph, *, agent_id: str | None, outcome: str) -> TaskRun:
    run = TaskRun(graph_id=graph.id, ask_kind="nl", body="why", status="succeeded", outcome=outcome, agent_id=agent_id)
    session.add(run)
    await session.flush()
    return run


async def _step(session: AsyncSession, graph: Graph, root: TaskRun, *, offered: list[str], applied: list[str]) -> None:
    session.add(
        TaskRun(
            graph_id=graph.id,
            parent_run_id=root.id,
            task_key="translate_thought",
            label="Translate",
            status="succeeded",
            finished_at=datetime.now(UTC),
            skills_offered=offered,
            skills_applied=applied,
        )
    )
    await session.flush()


async def test_v1_diffs_against_nothing(session: AsyncSession, graph: Graph, user: User) -> None:
    """A first version did not delete anything, so it is not compared to empty text."""
    skill = await skills.create(
        session, graph_id=graph.id, payload=SkillCreate(name="First", content="hello"), actor_id=user.id
    )

    diff = await skills.diff_version(session, skill=skill, version=1)

    assert diff.against_version is None
    assert {f.field for f in diff.fields} == {"description", "content", "when_to_use"}
    assert [f.field for f in diff.fields if f.changed] == ["content"]


async def test_a_rewrite_reports_only_the_field_that_moved(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await skills.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Moved", description="keep", content="before"),
        actor_id=user.id,
    )
    await skills.publish(session, skill=skill, payload=SkillVersionPublish(content="after"), actor_id=user.id)

    diff = await skills.diff_version(session, skill=skill, version=2)

    assert diff.against_version == 1
    changed = {f.field: f for f in diff.fields if f.changed}
    assert list(changed) == ["content"]
    assert any(line.startswith("-before") for line in changed["content"].lines)
    assert any(line.startswith("+after") for line in changed["content"].lines)


async def test_usage_splits_the_current_version_by_agent_and_by_outcome(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await skills.create(session, graph_id=graph.id, payload=SkillCreate(name="Split"), actor_id=user.id)
    v1 = skill.current_version_id
    explorer = Agent(graph_id=graph.id, name="Explorer")
    session.add(explorer)
    await session.flush()

    answered = await _run(session, graph, agent_id=explorer.id, outcome="answered")
    failed = await _run(session, graph, agent_id=explorer.id, outcome="failed")
    await _step(session, graph, answered, offered=[v1], applied=[v1])
    await _step(session, graph, failed, offered=[v1], applied=[])

    report = await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=25)

    assert [(a.agent_name, a.offered, a.applied) for a in report.by_agent] == [("Explorer", 2, 1)]
    assert sorted((o.outcome, o.offered, o.applied) for o in report.by_outcome) == [
        ("answered", 1, 1),
        ("failed", 1, 0),
    ]


async def test_a_handful_of_runs_is_not_enough_to_read(session: AsyncSession, graph: Graph, user: User) -> None:
    """US6 — offered 1, applied 0 is one run, not 0%."""
    skill = await skills.create(session, graph_id=graph.id, payload=SkillCreate(name="Thin"), actor_id=user.id)
    root = await _run(session, graph, agent_id=None, outcome="answered")
    await _step(session, graph, root, offered=[skill.current_version_id], applied=[])

    report = await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=25)

    assert MIN_OFFERS_TO_READ > 1
    assert report.versions[0].offered == 1
    assert report.versions[0].enough_to_read is False
