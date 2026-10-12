"""Rolling back — an earlier version restored as the next one, nothing rewritten.

Three cases: the restore itself, the refusal while a draft is open, and the
refusal for the version that is already current.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.apps.task_plans.models import PlanOrigin, TaskPlan
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.core.events.models import Event
from invana.runtime.managers import SkillDraftManager
from tests.skills.drawn import publish_drawn

skills = SkillManager()
drafts = SkillDraftManager()


async def _skill_at_v2(session: AsyncSession, graph: Graph, user: User):
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Escalate a late supplier", content="first", when_to_use="late"),
        actor_id=user.id,
        publish=True,
    )
    await publish_drawn(session, skill=skill, payload=SkillVersionPublish(content="second"), actor_id=user.id)
    return skill


async def test_a_rollback_publishes_the_earlier_text_and_plan_as_the_next_version(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await _skill_at_v2(session, graph, user)
    v1 = await skills.get_version(session, skill=skill, version=1)

    restored = await drafts.rollback(session, skill=skill, version=1, actor_id=user.id, why="v2 slowed it down")

    assert restored.version == 3
    assert restored.restored_from_version == 1
    assert skill.current_version_id == restored.id
    assert skill.content == "first"
    # A copy of v1's plan, never v1's own row — v1 keeps its plan.
    assert restored.plan_id != v1.plan_id
    plan = await session.get(TaskPlan, restored.plan_id)
    source = await session.get(TaskPlan, v1.plan_id)
    assert plan.origin == source.origin == PlanOrigin.generated.value
    assert plan.source_skill_version_ids == [restored.id]
    # Every earlier version still resolves, unchanged.
    assert [v.version for v in await skills.list_versions(session, skill=skill)] == [3, 2, 1]
    assert (await skills.get_version(session, skill=skill, version=2)).content == "second"

    event = (
        (await session.execute(select(Event).where(Event.target_id == skill.id).order_by(Event.created_at.desc())))
        .scalars()
        .first()
    )
    assert event.details["restored_from"] == 1
    assert event.details["why"] == "v2 slowed it down"


async def test_a_rollback_is_refused_while_a_draft_is_open(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await _skill_at_v2(session, graph, user)
    draft = await drafts.ensure_draft(session, skill=skill)
    await skills.update_draft(session, draft=draft, payload=SkillVersionPublish(content="unpublished work"))

    with pytest.raises(ConflictError, match="draft"):
        await drafts.rollback(session, skill=skill, version=1, actor_id=user.id)

    # The draft is untouched and still owns the next number.
    assert (await skills.get_draft(session, skill=skill)).content == "unpublished work"
    assert skill.version == 2


async def test_rolling_back_to_the_current_version_is_refused(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await _skill_at_v2(session, graph, user)

    with pytest.raises(ConflictError, match="already the current version"):
        await drafts.rollback(session, skill=skill, version=2, actor_id=user.id)
