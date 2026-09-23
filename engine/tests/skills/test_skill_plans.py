"""A skill version owns a plan (docs/for-developers/building-engine/skills-draw-as-plans.md).

Four claims, and they are the ones the surface rests on: the product's own
playbook is seeded as an ordinary skill, a new skill starts as a draft that
already has a plan, publishing is one act, and a published version cannot be
edited.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.schemas import SkillCreate, SkillVersionPublish
from invana.core.auth.models import User
from invana.core.errors import ValidationError
from invana.runtime.managers import BuiltinSkillSeeder, SkillDraftManager
from invana.runtime.managers.skill_seed import NAME as BUILTIN_NAME

pytestmark = pytest.mark.asyncio

skills = SkillManager()
drafts = SkillDraftManager()
seeder = BuiltinSkillSeeder()


async def test_the_graph_is_seeded_with_the_playbook_the_product_runs(session: AsyncSession, graph: Graph) -> None:
    reads = await drafts.list_reads(session, graph_id=graph.id)
    builtin = next(r for r in reads if r.name == BUILTIN_NAME)

    assert builtin.origin == "builtin"
    assert builtin.is_draft is False and builtin.version == 1
    assert builtin.plan is not None
    # Four tasks and the check — and the bands they touch, in strip order.
    assert builtin.plan.step_count == 5
    assert builtin.plan.layers == ["graph data", "llm", "agent"]

    skill = await skills.get(session, skill_id=builtin.id, graph_id=graph.id)
    plan = await drafts.plan_read(session, version=skill.current_version)
    understand = next(n for n in plan.nodes if n.task == "translate_thought")
    assert understand.layer == "llm"
    assert "turn it into a query" in (understand.source_span or "")
    # Every node names the sentence it was drawn from (C11) — and "Be concise."
    # produced none of them, which is what *unmapped* means.
    assert all(n.source_span for n in plan.nodes)
    assert not any("Be concise." in (n.source_span or "") for n in plan.nodes)

    # Seeding twice converges on one copy.
    assert await seeder.ensure_seeded(session, graph_id=graph.id) is None


async def test_a_new_skill_is_a_draft_that_already_has_a_plan(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="Escalate", when_to_use="when an order is late"),
        actor_id=user.id,
    )
    read = await drafts.read_for(session, skill=skill)

    assert read.is_draft is True and read.current_version_id is None
    assert read.draft_version_id is not None
    # One node, and it is a person's (SK15 · SK22) — never an empty canvas.
    assert read.plan is not None and read.plan.step_count == 1
    assert read.plan.layers == ["human"]

    draft = await skills.get_draft(session, skill=skill)
    published = await drafts.publish(
        session, skill=skill, payload=SkillVersionPublish(content="Chase it."), actor_id=user.id
    )

    assert published.id == draft.id, "publishing stamps the draft rather than copying it"
    assert published.is_draft is False and published.version == 1
    assert skill.current_version_id == published.id
    assert published.plan_id == draft.plan_id
    # Nothing is offered a draft, and nothing is left open behind a publish.
    assert await skills.get_draft(session, skill=skill) is None


async def test_a_published_version_cannot_be_edited_and_a_builtin_cannot_be_deleted(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await drafts.list_reads(session, graph_id=graph.id)  # seeds
    builtin = await skills.skills_qs.by_name(session, graph_id=graph.id, name=BUILTIN_NAME)

    with pytest.raises(ValidationError):
        await skills.update_draft(
            session,
            draft=builtin.current_version,
            payload=SkillVersionPublish(content="rewritten in place"),
        )

    with pytest.raises(ValidationError):
        await skills.delete(session, skill=builtin, actor_id=user.id)

    # Editing it is ordinary: the next version publishes over the seeded one.
    v2 = await drafts.publish(
        session,
        skill=builtin,
        payload=SkillVersionPublish(when_to_use="when someone asks in prose"),
        actor_id=user.id,
    )
    assert v2.version == 2
    # A redraw is a revision: v2's plan is its own **copy** of what v1 drew, so
    # editing it can never reach back into the version a past step was offered.
    v1 = await skills.get_version(session, skill=builtin, version=1)
    assert v2.plan_id != v1.plan_id
    plan = await drafts.plan_read(session, version=v2)
    assert [n.task for n in plan.nodes] == [
        "translate_thought",
        "validate_query",
        "execute_graph_query",
        "shape_for_canvas",
        "verify_result",
    ]
