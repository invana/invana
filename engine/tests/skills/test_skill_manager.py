"""`SkillManager` — the rules, tested without a request.

That the manager is reachable this way *is* the point of migration-plan §6: the
same calls `server/skills/views.py` makes, with no HTTP client in sight. Five
cases — the happy path, the two refusals, and the two rules the events carry.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillUpdate
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events.models import Event
from invana.runtime.managers import SkillDraftManager

skills = SkillManager()
drafts = SkillDraftManager()


async def _events(session: AsyncSession, action: str) -> list[Event]:
    rows = await session.execute(select(Event).where(Event.action == action))
    return list(rows.scalars().all())


async def test_create_then_list_returns_it_and_records_the_write(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    created = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Cypher basics", description="d", content="c", when_to_use="w"),
        actor_id=user.id,
        publish=True,
    )

    listed = await skills.list_for_graph(session, graph_id=graph.id)
    assert [s.id for s in listed] == [created.id]

    events = await _events(session, "skill.create")
    assert len(events) == 1
    assert events[0].target_id == created.id
    assert events[0].details["name"] == "Cypher basics"


async def test_a_skill_in_another_graph_reads_as_absent(
    session: AsyncSession, graph: Graph, other_graph: Graph, user: User
) -> None:
    """Not 'forbidden' — the caller must not learn that the id exists."""
    created = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Scoped"), actor_id=user.id, publish=True
    )

    with pytest.raises(NotFoundError):
        await skills.get(session, skill_id=created.id, graph_id=other_graph.id)


async def test_a_duplicate_name_in_the_same_graph_is_refused(session: AsyncSession, graph: Graph, user: User) -> None:
    await drafts.create(session, graph_id=graph.id, payload=SkillCreate(name="Same"), actor_id=user.id, publish=True)

    with pytest.raises(ConflictError):
        await drafts.create(
            session, graph_id=graph.id, payload=SkillCreate(name="Same"), actor_id=user.id, publish=True
        )


async def test_update_touches_only_the_fields_given_and_names_them(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Before", description="keep me"),
        actor_id=user.id,
        publish=True,
    )

    await drafts.update(session, skill=skill, payload=SkillUpdate(name="After"), actor_id=user.id)

    assert skill.name == "After"
    assert skill.description == "keep me"
    # `changed` is a before/after map, keyed by field — only the field that
    # actually moved appears, which is what makes the audit row readable.
    changed = (await _events(session, "skill.update"))[0].details["changed"]
    assert list(changed) == ["name"]
    assert changed["name"] == {"before": "Before", "after": "After"}


async def test_delete_removes_the_row_and_the_event_keeps_the_name(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """10.2 — the record outlives the subject it describes."""
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Doomed"), actor_id=user.id, publish=True
    )

    await skills.delete(session, skill=skill, actor_id=user.id)
    await session.flush()

    assert await skills.list_for_graph(session, graph_id=graph.id) == []
    events = await _events(session, "skill.delete")
    assert events[0].details["name"] == "Doomed"
