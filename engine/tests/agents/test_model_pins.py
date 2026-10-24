"""Pinning a model version — the pin decides, the lens still bounds, nothing falls back.

Positive: an agent's pin moves as a change and wins over the cast; a settled
ask re-runs on the version it recorded. Negative: an alias, a model the Graph
does not offer and a pin the lens denies are refused; a re-run on a version no
longer offered is refused by name.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.managers import AgentManager
from invana.apps.agents.schemas import AgentCreate, AgentUpdate
from invana.apps.govern.managers import LLMEndpointManager
from invana.apps.govern.rules import Effective, Rule
from invana.apps.graphs.models import Graph
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.core.auth.models import User
from invana.core.errors import ConflictError, ValidationError
from invana.core.events import actions
from invana.core.events.models import Event
from invana.runtime import services
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.workflows import NL_QUERY

agents = AgentManager()
endpoints = LLMEndpointManager()

OPUS = "llm/anthropic-prod/claude-opus-5-5"


async def _offer(session: AsyncSession, graph: Graph) -> None:
    provider = LLMProvider(graph_id=graph.id, name="anthropic-prod", provider=LLMProviderKind.anthropic, guardrails={})
    session.add(provider)
    await session.flush()
    for model_id, rank in (("claude-opus-5-5", 15), ("claude-haiku-4-5", 1), ("claude-opus-latest", 15)):
        capabilities = {"cost_rank": rank, "power_rank": rank}
        session.add(LLMModel(provider_id=provider.id, model_id=model_id, capabilities=capabilities, pricing={}))
    await session.flush()


async def test_an_agent_pin_moves_as_a_change_and_wins_over_the_cast(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await _offer(session, graph)
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)

    await agents.update_agent(
        session, agent=agent, payload=AgentUpdate(model_pin=OPUS, why="hold the version"), actor=user
    )

    assert agent.model_pin == OPUS and agent.version == 2
    event = (
        await session.execute(select(Event).where(Event.target_id == agent.id, Event.action == actions.AGENT_UPDATE))
    ).scalar_one()
    assert event.details["diff"]["model_pin"]["after"] == OPUS
    assert event.details["why"] == "hold the version"
    # The shipped cast would pick the cheapest model to extract; the pin decides.
    picked = await endpoints.resolve(session, graph_id=graph.id, role="extract", pins=(None, agent.model_pin))
    assert picked.model_id == "claude-opus-5-5"


@pytest.mark.parametrize(
    ("pin", "error"),
    [("llm/anthropic-prod/claude-opus-latest", "pin_alias"), ("llm/anthropic-prod/claude-opus-4-8", "pin_not_offered")],
)
async def test_an_alias_or_a_model_the_graph_does_not_offer_is_refused_where_it_is_typed(
    session: AsyncSession, graph: Graph, user: User, pin: str, error: str
) -> None:
    await _offer(session, graph)
    agent = await agents.create_agent(session, graph=graph, payload=AgentCreate(name="Analyst"), actor=user)

    with pytest.raises(ValidationError) as exc:
        await agents.update_agent(session, agent=agent, payload=AgentUpdate(model_pin=pin), actor=user)

    assert exc.value.detail["error"] == error
    assert agent.model_pin is None and agent.version == 1


async def test_a_pin_the_lens_denies_refuses_the_run(session: AsyncSession, graph: Graph) -> None:
    await _offer(session, graph)
    denied = Effective(rules=[Rule(match="llm/anthropic-prod/**", allow=False)])

    with pytest.raises(ValidationError) as exc:
        await endpoints.resolve(session, graph_id=graph.id, effective=denied, pins=(OPUS,))

    assert exc.value.detail["error"] == "pin_refused"
    assert exc.value.detail["address"] == OPUS


async def _settled_ask(session: AsyncSession, graph: Graph, user: User, model_version: str) -> TaskRun:
    run = TaskRun(
        graph_id=graph.id,
        author_id=user.id,
        ask_kind="nl",
        body="Which suppliers ship late?",
        flow_key=NL_QUERY.key,
        model_version=model_version,
        status=RunStatus.succeeded.value,
    )
    session.add(run)
    await session.flush()
    return run


async def test_a_settled_ask_re_runs_on_the_version_it_recorded(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await _offer(session, graph)
    run = await _settled_ask(session, graph, user, "claude-haiku-4-5")

    rerun = await services.rerun_run(session, graph=graph, run=run, versions="same", actor_id=user.id)

    assert rerun.id != run.id and rerun.rerun_of_run_id == run.id
    # Not today's cast, which would pick the most capable model to decide.
    assert rerun.model_version == "claude-haiku-4-5"
    assert run.status == RunStatus.succeeded.value


async def test_a_re_run_on_a_version_no_longer_offered_is_refused_by_name(
    session: AsyncSession, graph: Graph, user: User
) -> None:
    await _offer(session, graph)
    run = await _settled_ask(session, graph, user, "claude-opus-4-8")

    with pytest.raises(ConflictError) as exc:
        await services.rerun_run(session, graph=graph, run=run, versions="same", actor_id=user.id)

    assert exc.value.detail["error"] == "version_not_offered"
    assert "claude-opus-4-8" in exc.value.detail["message"]
