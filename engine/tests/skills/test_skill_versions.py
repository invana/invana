"""Publishing — the rule that a version, once published, never changes.

Five cases: the mint on create, the mint on edit, the immutability of what came
before, the edit that is not a publish, and the version that does not exist.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillUpdate, SkillVersionPublish
from invana.core.auth.models import User
from invana.core.errors import NotFoundError
from invana.core.events.models import Event
from invana.runtime.managers import SkillDraftManager

skills = SkillManager()
drafts = SkillDraftManager()


async def test_creating_a_skill_mints_v1_and_points_the_head_at_it(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Escalate a late supplier", content="c", when_to_use="w"),
        actor_id=user.id,
        publish=True,
    )

    versions = await skills.list_versions(session, skill=skill)
    assert [v.version for v in versions] == [1]
    assert skill.current_version_id == versions[0].id
    # The text reads through the head, so a caller never has to know versions exist.
    assert skill.version == 1
    assert skill.content == "c"
    assert skill.when_to_use == "w"


async def test_editing_the_prose_publishes_the_next_version_and_leaves_the_last_alone(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK2 — a published version is immutable, and the previous one still resolves."""
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Cypher basics", content="first", when_to_use="always"),
        actor_id=user.id,
        publish=True,
    )

    await drafts.update(session, skill=skill, payload=SkillUpdate(content="second"), actor_id=user.id)

    assert skill.version == 2
    assert skill.content == "second"
    # `when_to_use` was not sent, so it carries over rather than blanking.
    assert skill.when_to_use == "always"

    v1 = await skills.get_version(session, skill=skill, version=1)
    assert v1.content == "first"

    published = (await session.execute(select(Event).where(Event.action == "skill.publish"))).scalars().all()
    # One for the edit; creating the skill emits `skill.create`, not a publish.
    assert [e.details["version"] for e in published] == [2]
    assert list(published[0].details["changed"]) == ["content"]


async def test_resending_identical_prose_does_not_publish(session: AsyncSession, graph: Graph, user: User) -> None:
    """A new version restarts the usage count (US3), so an unchanged save must not mint one."""
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Steady", content="same"), actor_id=user.id, publish=True
    )

    await drafts.update(session, skill=skill, payload=SkillUpdate(name="Renamed", content="same"), actor_id=user.id)

    assert skill.name == "Renamed"
    assert [v.version for v in await skills.list_versions(session, skill=skill)] == [1]


async def test_publishing_explicitly_carries_over_what_it_does_not_send(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Carry", description="d", content="c", when_to_use="w"),
        actor_id=user.id,
        publish=True,
    )

    version = await drafts.publish(
        session,
        skill=skill,
        payload=SkillVersionPublish(when_to_use="only on Tuesdays"),
        actor_id=user.id,
    )

    assert version.version == 2
    assert (version.description, version.content) == ("d", "c")
    assert version.published_by_id == user.id


async def test_a_version_that_was_never_published_reads_as_absent(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Only one"), actor_id=user.id, publish=True
    )

    with pytest.raises(NotFoundError):
        await skills.get_version(session, skill=skill, version=2)
