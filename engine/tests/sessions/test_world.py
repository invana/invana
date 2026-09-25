"""A session carries the default bounds for its asks; the run still freezes them
(docs/for-developers/modules/ask/spec.md AS5 · the-assistant.md AD16 · AD17)."""

from __future__ import annotations

import pytest

from invana.apps.govern.models import Lens, LensKind
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.apps.sessions.managers import SessionManager
from invana.apps.sessions.schemas import SendMessage
from invana.core.errors import ValidationError
from invana.runtime import services as run_services

sessions = SessionManager()

pytestmark = pytest.mark.asyncio


async def _lens(session, graph, *, kind: str = LensKind.world.value, name: str = "EU") -> Lens:
    lens = Lens(
        graph_id=graph.id,
        kind=kind,
        key=name.lower(),
        name=name,
        scope="graph" if kind == LensKind.guardrail.value else None,
    )
    session.add(lens)
    await session.flush()
    return lens


async def _ask(session, sess, graph, user, **payload):
    _, _, th = await run_services.open_turn(
        session, sess=sess, graph=graph, payload=SendMessage(content="MATCH (n) RETURN n", **payload), actor_id=user.id
    )
    return th


async def test_an_ask_runs_in_the_sessions_world_unless_it_narrows_for_itself(session, graph, user):
    world = await _lens(session, graph)
    sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="t")
    await sessions.update_session(session, sess=sess, bounds={"lens_id": world.id}, actor_id=user.id)

    # Omitted: the thread's world, and the turn is tagged with it by name.
    th = await _ask(session, sess, graph, user)
    assert th.lens_id == world.id
    [msg] = [m for m in await sessions.list_messages(session, sess=sess) if m.run_id == th.id]
    assert (await run_services.worlds_for_messages(session, [msg]))[msg.id] == (world.id, "EU")

    # Null: *Everything*, for this ask only — the session keeps its world.
    assert (await _ask(session, sess, graph, user, lens_id=None)).lens_id is None
    assert sess.lens_id == world.id

    # A deleted world leaves its id behind, and the next ask reads *Everything*.
    await session.delete(world)
    await session.flush()
    assert (await _ask(session, sess, graph, user)).lens_id is None


async def test_a_guardrail_is_refused_and_the_spend_is_clamped_to_the_agents(session, graph, user):
    sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="t")
    rail = await _lens(session, graph, kind=LensKind.guardrail.value, name="House rules")

    with pytest.raises(ValidationError, match="guardrail"):
        await sessions.update_session(session, sess=sess, bounds={"lens_id": rail.id}, actor_id=user.id)

    await sessions.update_session(session, sess=sess, bounds={"max_cost_usd_run": 99.0}, actor_id=user.id)
    assert sess.max_cost_usd_run == 2.0  # the seeded agent's DEFAULT_BUDGET cap
    th = await _ask(session, sess, graph, user)
    assert th.params["max_cost_usd_run"] == 2.0


async def test_an_ask_a_guardrail_refuses_names_its_world_role_address_and_bound(session, graph, user):
    """AG35 — the 422 carries the facts the reply draws *this ask was not run*
    from: the world the ask was in, the role, the address it cast, and whose
    rule denied it (AG6)."""
    provider = LLMProvider(graph_id=graph.id, name="anthropic-prod", provider=LLMProviderKind.anthropic, guardrails={})
    session.add(provider)
    await session.flush()
    session.add(LLMModel(provider_id=provider.id, model_id="claude-opus-5", capabilities={}, pricing={}))
    rail = await _lens(session, graph, kind=LensKind.guardrail.value, name="Nothing leaves")
    rail.rules = [{"match": "llm/anthropic-prod/**", "allow": False}]
    world = await _lens(session, graph, name="EU")
    world.cast = {"decide": "llm/anthropic-prod/claude-opus-5"}
    await session.flush()
    sess = await sessions.create_session(session, graph=graph, user_id=user.id, title="t")

    with pytest.raises(ValidationError) as exc:
        await run_services.open_turn(
            session,
            sess=sess,
            graph=graph,
            payload=SendMessage(content="who flies BER-LIS?", mode="nl", lens_id=world.id),
            actor_id=user.id,
        )
    detail = exc.value.detail
    assert detail["error"] == "cast_refused"
    assert (detail["world"], detail["role"], detail["address"]) == ("EU", "decide", "llm/anthropic-prod/claude-opus-5")
    assert detail["denied_in"] == "the Graph's guardrail 'Nothing leaves'"
