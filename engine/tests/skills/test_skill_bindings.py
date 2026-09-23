"""Binding — the one write path that offers a skill to an agent.

The bind and its event, the two refusals, what unbinding leaves behind — and
both halves of the bind check (BN5): the **envelope**, which refuses a skill
whose plan names a callable the agent may never call, and the **lens**, which
refuses one whose plan reaches a band the agent's guardrails have shut (BN10).
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.govern.models import Lens, LensKind
from invana.apps.graphs.models import Graph
from invana.apps.skills.managers import SkillBindingManager, SkillManager
from invana.apps.skills.schemas import SkillCreate
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events.models import Event
from invana.runtime.managers import SkillBindManager, SkillDraftManager
from invana.runtime.managers.skill_seed import NAME as BUILTIN_NAME

skills = SkillManager()
drafts = SkillDraftManager()
bindings = SkillBindingManager()
binds = SkillBindManager()


async def _agent(session: AsyncSession, graph: Graph, name: str = "Explorer", spec: dict | None = None) -> Agent:
    agent = Agent(graph_id=graph.id, name=name, workflow_spec=spec or {})
    session.add(agent)
    await session.flush()
    return agent


#: What the Modeller's envelope allows — nothing the NL playbook names.
MODELLER_SPEC = {"entry": "understand_ask", "allow": ["understand_ask", "propose_model", "validate_proposal"]}
PLANNING_SPEC = {
    "entry": "understand",
    "allow": [
        "understand_intent",
        "plan_workflow",
        "translate_thought",
        "validate_query",
        "execute_graph_query",
        "shape_for_canvas",
        "verify_result",
    ],
}


async def _builtin(session: AsyncSession, graph: Graph):
    """The seeded playbook — the one skill in a fresh Graph whose plan names
    real callables, which is what makes it the subject of the envelope check."""
    reads = await drafts.list_reads(session, graph_id=graph.id)
    builtin = next(r for r in reads if r.name == BUILTIN_NAME)
    return await skills.get(session, skill_id=builtin.id, graph_id=graph.id)


async def test_binding_offers_the_skill_and_records_who_did_it(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Escalate"), actor_id=user.id, publish=True
    )
    agent = await _agent(session, graph)

    await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)
    await session.refresh(agent, ["bound_skills"])

    assert agent.skill_ids == [skill.id]
    event = (await session.execute(select(Event).where(Event.action == "agent.skill_bound"))).scalars().one()
    assert event.target_id == agent.id
    assert event.details["skill_name"] == "Escalate"
    assert event.details["agent_name"] == "Explorer"


async def test_binding_what_is_already_bound_is_refused(session: AsyncSession, graph: Graph, user: User) -> None:
    """Not a silent no-op: the caller believes it is changing the bindings."""
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Twice"), actor_id=user.id, publish=True
    )
    agent = await _agent(session, graph)
    await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)

    with pytest.raises(ConflictError):
        await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)


async def test_unbinding_what_was_never_bound_reads_as_absent(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Unbound"), actor_id=user.id, publish=True
    )
    agent = await _agent(session, graph)

    with pytest.raises(NotFoundError):
        await bindings.unbind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)


async def test_unbinding_leaves_the_skill_and_the_other_agents_alone(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """C4 · the journey — unbound here, still bound elsewhere."""
    skill = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="Shared"), actor_id=user.id, publish=True
    )
    one = await _agent(session, graph, name="One")
    two = await _agent(session, graph, name="Two")
    for agent in (one, two):
        await bindings.bind(session, skill=skill, agent_id=agent.id, agent_name=agent.name, actor_id=user.id)

    await bindings.unbind(session, skill=skill, agent_id=one.id, agent_name=one.name, actor_id=user.id)
    await session.refresh(one, ["bound_skills"])
    await session.refresh(two, ["bound_skills"])

    assert one.skill_ids == []
    assert two.skill_ids == [skill.id]
    # The skill itself is untouched — unbinding is not deleting.
    assert await skills.get(session, skill_id=skill.id, graph_id=graph.id) is skill


# ── the envelope check (BN5) ─────────────────────────────────────────────────


async def test_a_skill_the_envelope_could_never_run_is_refused_at_bind_time(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """The refusal names the step, its bound, and which checks ran."""
    skill = await _builtin(session, graph)
    agent = await _agent(session, graph, name="Modeller", spec=MODELLER_SPEC)

    with pytest.raises(ConflictError) as refused:
        await bindings.bind(
            session,
            skill=skill,
            agent_id=agent.id,
            agent_name=agent.name,
            actor_id=user.id,
            check=binds.check,
        )

    detail = refused.value.detail
    assert detail["error"] == "skill_binding_refused"
    assert detail["check"] == "envelope"
    assert detail["step_key"] == "translate_thought"
    assert detail["bound"] == "llm"
    assert detail["skill_version_id"] == skill.current_version_id
    # BN7 — a bind is never refused on grounds it did not check. Both halves
    # run now (BN10), and the refusal still says which.
    assert detail["checked"] == ["envelope", "lens"] and detail["not_checked"] == []
    # BN13's negative — no layer strip here. This refusal is about a `step_key`
    # and read no bands, and a strip beside it would suggest a ground it did
    # not check (BN7).
    assert "layers" not in detail

    # Nothing was written: a refused bind leaves the bindings as they were.
    await session.refresh(agent, ["bound_skills"])
    assert agent.skill_ids == []


async def test_an_envelope_that_allows_the_plan_binds(session: AsyncSession, graph: Graph, user: User) -> None:
    skill = await _builtin(session, graph)
    agent = await _agent(session, graph, name="Analyst", spec=PLANNING_SPEC)

    await bindings.bind(
        session,
        skill=skill,
        agent_id=agent.id,
        agent_name=agent.name,
        actor_id=user.id,
        check=binds.check,
    )
    await session.refresh(agent, ["bound_skills"])

    assert agent.skill_ids == [skill.id]


async def test_a_human_plan_binds_anywhere_and_an_agent_without_an_envelope_is_never_refused(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """SK15 · BN7 — the two ways the check has nothing to refuse on.

    `form: human` is not something the envelope ceilings, which is what keeps
    the universal fallback bindable; and an agent with no envelope is not a
    narrow agent but an unconfigured one.
    """
    fallback = await drafts.create(
        session, graph_id=graph.id, payload=SkillCreate(name="A person does it"), actor_id=user.id, publish=True
    )
    narrow = await _agent(session, graph, name="Modeller", spec=MODELLER_SPEC)
    unconfigured = await _agent(session, graph, name="Unconfigured")

    await bindings.bind(
        session,
        skill=fallback,
        agent_id=narrow.id,
        agent_name=narrow.name,
        actor_id=user.id,
        check=binds.check,
    )
    await bindings.bind(
        session,
        skill=await _builtin(session, graph),
        agent_id=unconfigured.id,
        agent_name=unconfigured.name,
        actor_id=user.id,
        check=binds.check,
    )

    await session.refresh(narrow, ["bound_skills"])
    await session.refresh(unconfigured, ["bound_skills"])
    assert narrow.skill_ids == [fallback.id]
    assert len(unconfigured.skill_ids) == 1


# ── the lens check (BN10) ────────────────────────────────────────────────────


async def _guardrail(
    session: AsyncSession,
    graph: Graph,
    *,
    rules: list[dict] | None = None,
    closed: list[str] | None = None,
    scope: str = "graph",
) -> Lens:
    """A guardrail, written as a row — the grammar is tested where it lives."""
    lens = Lens(
        graph_id=graph.id,
        kind=LensKind.guardrail.value,
        key=f"bounds-{scope}",
        name="Bounds",
        scope=scope,
        rules=rules or [],
        closed_layers=closed or [],
    )
    session.add(lens)
    await session.flush()
    return lens


async def test_a_band_the_guardrails_shut_refuses_the_bind_and_names_its_rule(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """BN10 — the playbook's plan reaches `llm`, and this Graph has closed it.

    The refusal names the band and the rule, because a bound a person cannot
    point at is not something they can argue with.
    """
    skill = await _builtin(session, graph)
    agent = await _agent(session, graph, name="Analyst", spec=PLANNING_SPEC)
    await _guardrail(session, graph, rules=[{"match": "llm/**", "allow": False}])

    with pytest.raises(ConflictError) as refused:
        await bindings.bind(
            session,
            skill=skill,
            agent_id=agent.id,
            agent_name=agent.name,
            actor_id=user.id,
            check=binds.check,
        )

    detail = refused.value.detail
    assert detail["check"] == "lens"
    assert detail["layer"] == "llm"
    assert detail["reason"] == "denied_outright"
    assert detail["rule"] == "llm/**"
    assert detail["checked"] == ["envelope", "lens"] and detail["not_checked"] == []
    # BN13 — the strip is every band the plan declares, not only the shut one:
    # a plan that reaches four bands and is refused on one must not read like a
    # plan that only ever wanted that band.
    assert "llm" in detail["layers"] and len(detail["layers"]) > 1

    await session.refresh(agent, ["bound_skills"])
    assert agent.skill_ids == []


async def test_a_closed_band_that_names_nothing_refuses_where_a_narrower_denial_does_not(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """BN10 — the two ends of the same rule.

    A closed band admitting nothing is shut, so a plan that reaches it can
    never run. One denied participant beside others that are permitted is
    **not** a binding error: which one a run picks is decided inside the run,
    and refusing here would refuse on grounds the check cannot read (BN7).
    """
    skill = await _builtin(session, graph)
    narrow = await _agent(session, graph, name="Narrow", spec=PLANNING_SPEC)
    # Pinned on this agent alone, so the other one is bound under the Graph's
    # guardrails only — which say nothing.
    await _guardrail(session, graph, closed=["graph_data"], scope=f"agent:{narrow.id}")

    with pytest.raises(ConflictError) as refused:
        await bindings.bind(
            session,
            skill=skill,
            agent_id=narrow.id,
            agent_name=narrow.name,
            actor_id=user.id,
            check=binds.check,
        )
    assert refused.value.detail["reason"] == "closed_layer"
    assert refused.value.detail["layer"] == "graph data"

    wide = await _agent(session, graph, name="Wide", spec=PLANNING_SPEC)
    await _guardrail(
        session,
        graph,
        rules=[{"match": "graph_data/model/Deals", "allow": False}],
        scope=f"agent:{wide.id}",
    )
    await bindings.bind(
        session,
        skill=skill,
        agent_id=wide.id,
        agent_name=wide.name,
        actor_id=user.id,
        check=binds.check,
    )
    await session.refresh(wide, ["bound_skills"])
    assert wide.skill_ids == [skill.id]


async def test_a_band_the_plan_never_reaches_is_not_checked(session: AsyncSession, graph: Graph, user: User) -> None:
    """BN7 — `third_party/**` is denied, and the playbook goes nowhere near it."""
    skill = await _builtin(session, graph)
    agent = await _agent(session, graph, name="Analyst", spec=PLANNING_SPEC)
    await _guardrail(session, graph, rules=[{"match": "third_party/**", "allow": False}])

    await bindings.bind(
        session,
        skill=skill,
        agent_id=agent.id,
        agent_name=agent.name,
        actor_id=user.id,
        check=binds.check,
    )
    await session.refresh(agent, ["bound_skills"])
    assert agent.skill_ids == [skill.id]


async def test_a_band_whose_every_participant_is_denied_is_shut_even_without_a_layer_rule(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """BN10 — the exhaustive reading, which is the one that needs the catalogue.

    No rule names the `human` band as a whole and it is not closed; the three
    roles that exist are simply all denied. A plan whose only step is a person's
    can then never run, so binding it is refused.
    """
    fallback = await drafts.create(
        session,
        graph_id=graph.id,
        payload=SkillCreate(name="A person does it"),
        actor_id=user.id,
        publish=True,
    )
    agent = await _agent(session, graph, name="Analyst", spec=PLANNING_SPEC)
    await _guardrail(
        session,
        graph,
        rules=[{"match": f"human/role/{role}", "allow": False} for role in ("analyst", "owner", "member")],
    )

    with pytest.raises(ConflictError) as refused:
        await bindings.bind(
            session,
            skill=fallback,
            agent_id=agent.id,
            agent_name=agent.name,
            actor_id=user.id,
            check=binds.check,
        )

    detail = refused.value.detail
    assert detail["reason"] == "every_participant_denied"
    assert detail["layer"] == "human"
    assert detail["participant"] == "human/role/analyst"
    assert detail["rule"] == "human/role/analyst"


async def test_standings_run_the_checks_rather_than_predicting_them(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """BN10 — the three sections the Bindings tab draws, from one read.

    An agent the envelope refuses, one the guardrails refuse, and one that
    binds — each carrying the refusal the bind *would* raise, so the surface
    never has to re-read the rules itself.
    """
    skill = await _builtin(session, graph)
    narrow = await _agent(session, graph, name="Modeller", spec=MODELLER_SPEC)
    shut = await _agent(session, graph, name="Shut", spec=PLANNING_SPEC)
    fine = await _agent(session, graph, name="Analyst", spec=PLANNING_SPEC)
    await _guardrail(session, graph, rules=[{"match": "llm/**", "allow": False}], scope=f"agent:{shut.id}")

    await bindings.bind(
        session,
        skill=skill,
        agent_id=fine.id,
        agent_name=fine.name,
        actor_id=user.id,
        check=binds.check,
    )

    standings = {row["agent_id"]: row for row in await binds.standings(session, skill=skill)}

    assert standings[fine.id]["bound"] is True and standings[fine.id]["refusal"] is None
    assert standings[narrow.id]["refusal"]["check"] == "envelope"
    assert standings[shut.id]["refusal"]["check"] == "lens"
    assert standings[shut.id]["refusal"]["layer"] == "llm"


async def test_a_standing_names_the_world_the_agent_carries_and_nothing_when_it_carries_none(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    """BN12 — the row says which world, because a world changes which model decides.

    It is context and nothing else: the agent below carries a world *and*
    binds, which is the point — the check reads guardrails and never worlds
    (BN10), so a world never turns a bind into a refusal.
    """
    skill = await _builtin(session, graph)
    world = Lens(
        graph_id=graph.id,
        kind=LensKind.world.value,
        key="cheap",
        name="Cheap models only",
        # A world carries no scope — a guardrail is the one that is scoped
        # (`ck_lens_kind_shape`), which is the shape BN10's *guardrails, never
        # worlds* is about.
        scope=None,
        rules=[],
        closed_layers=[],
    )
    session.add(world)
    await session.flush()

    lensed = await _agent(session, graph, name="Analyst", spec=PLANNING_SPEC)
    lensed.lens_id = world.id
    bare = await _agent(session, graph, name="Plain", spec=PLANNING_SPEC)
    await session.flush()

    standings = {row["agent_id"]: row for row in await binds.standings(session, skill=skill)}

    assert standings[lensed.id]["world"] == "Cheap models only"
    assert standings[lensed.id]["refusal"] is None
    # An agent pinned to nothing carries no world — absent, never a placeholder.
    assert standings[bare.id]["world"] is None
