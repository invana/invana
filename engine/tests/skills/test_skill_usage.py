"""Usage is per version — the claim *offered 40, applied 31* belongs to one text.

Three cases: counts attach to the version, publishing starts a fresh count, and
a step row names the version it was actually offered.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.runtime.managers import SkillDraftManager, SkillUsageManager
from invana.runtime.models import TaskRun

skills = SkillManager()
drafts = SkillDraftManager()
usage = SkillUsageManager()


async def _root(session: AsyncSession, graph: Graph) -> TaskRun:
    run = TaskRun(graph_id=graph.id, ask_kind="nl", body="why", status="succeeded")
    session.add(run)
    await session.flush()
    return run


async def _step(
    session: AsyncSession,
    graph: Graph,
    root: TaskRun,
    *,
    offered: list[str],
    applied: list[str],
) -> TaskRun:
    node = TaskRun(
        graph_id=graph.id,
        parent_run_id=root.id,
        task_key="translate_thought",
        label="Translate",
        status="succeeded",
        finished_at=datetime.now(UTC),
        skills_offered=offered,
        skills_applied=applied,
    )
    session.add(node)
    await session.flush()
    return node


async def test_counts_attach_to_the_version_the_step_was_offered(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Escalate"), actor_id=user.id, publish=True
    )
    v1 = skill.current_version_id
    root = await _root(session, graph)
    await _step(session, graph, root, offered=[v1], applied=[v1])
    await _step(session, graph, root, offered=[v1], applied=[])
    await _step(session, graph, root, offered=[v1], applied=[])

    report = await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=25)

    assert [(v.version, v.offered, v.applied, v.gap) for v in report.versions] == [(1, 3, 1, 2)]
    assert report.current_version_id == v1


async def test_publishing_starts_a_fresh_count_and_leaves_the_old_one_standing(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """US3 — v4 starts its own count; v3 keeps its history."""
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Rewritten"), actor_id=user.id, publish=True
    )
    v1 = skill.current_version_id
    root = await _root(session, graph)
    await _step(session, graph, root, offered=[v1], applied=[v1])

    await drafts.publish(session, skill=skill, payload=SkillVersionPublish(content="better"), actor_id=user.id)
    v2 = skill.current_version_id
    await _step(session, graph, root, offered=[v2], applied=[])

    report = await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=25)

    # Newest first, and nothing is summed across the two.
    assert [(v.version, v.offered, v.applied) for v in report.versions] == [(2, 1, 0), (1, 1, 1)]


async def test_a_step_row_names_the_version_it_read(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Named"), actor_id=user.id, publish=True
    )
    other = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Ignored"), actor_id=user.id, publish=True
    )
    root = await _root(session, graph)
    # The step carried two skills; only one of them is the one being read.
    await _step(
        session,
        graph,
        root,
        offered=[other.current_version_id, skill.current_version_id],
        applied=[skill.current_version_id],
    )

    report = await usage.for_skill(session, skill=skill, graph_id=graph.id, limit=25)

    assert len(report.recent_steps) == 1
    step = report.recent_steps[0]
    assert step.skill_version_id == skill.current_version_id
    assert step.version == 1
    assert step.reported is True
