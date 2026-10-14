"""Publish needs a plan drawn from the exact text being published.

A draw stamps the digest of the words it read; publish compares it with the
draft's text at that moment. These cases are the gate's two refusals and the
one path that passes without a draw: a draft opened over a published version
carries that version's plan, which is the plan of its text.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.core.errors import ConflictError
from invana.runtime.managers import SkillDraftManager
from tests.skills.drawn import draw

pytestmark = pytest.mark.asyncio

skills = SkillManager()
drafts = SkillDraftManager()


async def _published(session: AsyncSession, graph: Graph, user: User):
    return await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Escalate", content="Chase the supplier."),
        actor_id=user.id,
        publish=True,
    )


async def test_a_drawn_draft_publishes_and_an_unchanged_one_needs_no_draw(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await _published(session, graph, user)

    # Opened over v1, the draft carries v1's plan and says it is drawn.
    assert (await drafts.draft_read(session, skill=skill)).drawn is True
    v2 = await drafts.publish(session, skill=skill, payload=SkillVersionPublish(why="Same words."), actor_id=user.id)
    assert v2.version == 2

    await drafts.write_draft(session, skill=skill, payload=SkillVersionPublish(content="Telephone the supplier."))
    assert (await drafts.draft_read(session, skill=skill)).drawn is False
    await draw(session, skill=skill)
    assert (await drafts.draft_read(session, skill=skill)).drawn is True

    v3 = await drafts.publish(session, skill=skill, payload=SkillVersionPublish(), actor_id=user.id)
    assert v3.version == 3 and v3.content == "Telephone the supplier."


@pytest.mark.parametrize("edit_in", ["draft", "payload"])
async def test_text_changed_after_the_draw_is_refused(
    session: AsyncSession, graph: Graph, user: User, edit_in: str
) -> None:
    skill = await _published(session, graph, user)
    await drafts.write_draft(session, skill=skill, payload=SkillVersionPublish(content="Telephone the supplier."))
    await draw(session, skill=skill)

    edited = SkillVersionPublish(content="Telephone, then email, the supplier.")
    if edit_in == "draft":
        await drafts.write_draft(session, skill=skill, payload=edited)
        edited = SkillVersionPublish()

    with pytest.raises(ConflictError, match="draw it again"):
        await drafts.publish(session, skill=skill, payload=edited, actor_id=user.id)
    assert skill.version == 1


async def test_a_new_skill_never_drawn_does_not_publish(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Fresh", content="Chase it."), actor_id=user.id
    )

    with pytest.raises(ConflictError):
        await drafts.publish(session, skill=skill, payload=SkillVersionPublish(), actor_id=user.id)
    assert skill.current_version_id is None
