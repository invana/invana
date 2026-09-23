"""Which model answers, now that nothing else can say.

``is_default`` and ``agents.llm_config_id`` are both gone, so the cast is the
only answer to *which model when nobody said*
([PM4](docs/for-developers/modules/agents/features/providers-and-models.md) ·
[PM14](docs/for-developers/modules/agents/features/providers-and-models.md)).
Two things have to be true for that to be safe: a Graph that cast nothing still
runs, and a cast naming a model the Graph does not offer refuses rather than
quietly substituting one.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.managers import LLMEndpointManager, NoEndpointError
from invana.apps.govern.managers.lens import to_effective
from invana.apps.govern.models import Lens, LensKind
from invana.apps.govern.rules import Role
from invana.apps.graphs.models import Graph
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.apps.llm_providers.schemas import LLMModelCreate, LLMProviderUpdate
from invana.core.errors import ConflictError

pytestmark = pytest.mark.asyncio

endpoints = LLMEndpointManager()

#: A valid Fernet key. No test here supplies a credential, so it is never used to
#: encrypt anything — the edit path just takes one.
_KEY = "kcTcpHnvOZ0WcmQb9SuYUwr6pEfAqfJi4o8b-h5g2vA="


async def _offer(session: AsyncSession, graph: Graph, name: str, kind: LLMProviderKind, *models) -> LLMProvider:
    provider = LLMProvider(graph_id=graph.id, name=name, provider=kind, guardrails={})
    session.add(provider)
    await session.flush()
    for model_id, capabilities in models:
        session.add(LLMModel(provider_id=provider.id, model_id=model_id, capabilities=capabilities, pricing={}))
    await session.flush()
    return provider


async def test_a_graph_that_casts_nothing_still_runs(session: AsyncSession, graph: Graph) -> None:
    """The shipped cast over what the Graph offers — cheapest that can read for
    ``extract``, most capable for ``decide``."""
    await _offer(
        session,
        graph,
        "anthropic-prod",
        LLMProviderKind.anthropic,
        ("claude-opus-5", {"cost_rank": 15, "power_rank": 15}),
        ("claude-haiku-4-5", {"cost_rank": 1, "power_rank": 1}),
    )

    decide = await endpoints.resolve(session, graph_id=graph.id, role=Role.decide)
    extract = await endpoints.resolve(session, graph_id=graph.id, role=Role.extract)

    assert decide.address == "llm/anthropic-prod/claude-opus-5"
    assert extract.address == "llm/anthropic-prod/claude-haiku-4-5"
    # The credential belongs to the provider and the id to the model: an
    # endpoint is what holds both (PM13).
    assert decide.id == extract.id and decide.model_row_id != extract.model_row_id


async def test_a_graph_offering_nothing_refuses_where_it_can_be_fixed(session: AsyncSession, graph: Graph) -> None:
    with pytest.raises(NoEndpointError) as exc:
        await endpoints.resolve(session, graph_id=graph.id)
    assert "Agents" in str(exc.value.detail)


async def test_a_cast_naming_a_model_the_graph_does_not_offer_refuses_by_name(
    session: AsyncSession, graph: Graph
) -> None:
    """Never a silent substitution — the refusal carries the address somebody
    has to go and fix."""
    await _offer(session, graph, "anthropic-prod", LLMProviderKind.anthropic, ("claude-opus-5", {}))
    world = Lens(
        graph_id=graph.id,
        kind=LensKind.world.value,
        key="retired",
        name="Retired",
        cast={"decide": "llm/anthropic-prod/claude-opus-4-8"},
    )
    session.add(world)
    await session.flush()

    with pytest.raises(NoEndpointError) as exc:
        await endpoints.resolve(session, graph_id=graph.id, effective=to_effective(world))
    assert "llm/anthropic-prod/claude-opus-4-8" in str(exc.value.detail)


async def test_a_model_a_world_casts_cannot_be_removed_and_one_nothing_casts_can(
    session: AsyncSession, graph: Graph, user
) -> None:
    """[PM11] — the refusal names the worlds, and the recourse is to retune them."""
    provider = await _offer(
        session,
        graph,
        "anthropic-prod",
        LLMProviderKind.anthropic,
        ("claude-opus-5", {}),
        ("claude-haiku-4-5", {}),
    )
    session.add(
        Lens(
            graph_id=graph.id,
            kind=LensKind.world.value,
            key="eu-h1-2026",
            name="EU · H1 2026",
            cast={"decide": "llm/anthropic-prod/claude-opus-5"},
        )
    )
    await session.flush()

    cast_by_a_world, nothing_casts_it = await endpoints.providers.list_models(session, provider=provider)

    with pytest.raises(ConflictError) as exc:
        await endpoints.remove_model(session, provider=provider, model=cast_by_a_world, actor_id=user.id)
    assert "EU · H1 2026" in str(exc.value.detail)

    await endpoints.remove_model(session, provider=provider, model=nothing_casts_it, actor_id=user.id)
    assert [m.model_id for m in await endpoints.providers.list_models(session, provider=provider)] == ["claude-opus-5"]


async def test_renaming_an_endpoint_a_guardrail_bounds_is_refused_and_the_rest_of_the_row_is_not(
    session: AsyncSession, graph: Graph, user
) -> None:
    """[PM18] — the `name` is the address segment, so a rename moves every
    address under the endpoint at once.

    A rule naming no single address is the case removal never had to answer:
    `deny llm/anthropic-prod/**` would simply stop matching, and a bound that
    matches nothing bounds nothing.
    """
    provider = await _offer(session, graph, "anthropic-prod", LLMProviderKind.anthropic, ("claude-opus-5", {}))
    session.add(
        Lens(
            graph_id=graph.id,
            kind=LensKind.guardrail.value,
            scope="graph",
            key="global",
            name="Global",
            rules=[{"match": "llm/anthropic-prod/**", "allow": False}],
        )
    )
    await session.flush()

    with pytest.raises(ConflictError) as exc:
        await endpoints.update_provider(
            session,
            provider=provider,
            payload=LLMProviderUpdate(name="anthropic-eu"),
            encryption_key=_KEY,
            actor_id=user.id,
        )
    assert "Global" in str(exc.value.detail) and "llm/anthropic-prod/*" in str(exc.value.detail)
    assert provider.name == "anthropic-prod"

    # Nothing else on the row is addressed, so nothing else is asked about.
    await endpoints.update_provider(
        session,
        provider=provider,
        payload=LLMProviderUpdate(base_url="https://eu.anthropic.example"),
        encryption_key=_KEY,
        actor_id=user.id,
    )
    assert provider.base_url == "https://eu.anthropic.example"


async def test_an_endpoint_nothing_names_renames(session: AsyncSession, graph: Graph, user) -> None:
    """The safe case is visibly safe — a world naming a *different* endpoint is
    not a bound on this one."""
    provider = await _offer(session, graph, "anthropic-spare", LLMProviderKind.anthropic, ("claude-opus-5", {}))
    session.add(
        Lens(
            graph_id=graph.id,
            kind=LensKind.world.value,
            key="eu-h1-2026",
            name="EU · H1 2026",
            cast={"decide": "llm/anthropic-prod/claude-opus-5"},
        )
    )
    await session.flush()

    await endpoints.update_provider(
        session,
        provider=provider,
        payload=LLMProviderUpdate(name="anthropic-eu"),
        encryption_key=_KEY,
        actor_id=user.id,
    )
    assert provider.name == "anthropic-eu"


async def test_a_model_added_today_is_ranked_like_one_backfilled_yesterday(
    session: AsyncSession, graph: Graph, user
) -> None:
    """PM17 — the ranks are what `shipped_cast` reads, and nothing else does.

    A model offered without them would sit at the middle of an ordering every
    backfilled row was seeded into from its published rate.
    """
    provider = await _offer(session, graph, "anthropic-prod", LLMProviderKind.anthropic)

    priced = await endpoints.add_model(
        session,
        provider=provider,
        payload=LLMModelCreate(model_id="claude-haiku-4-5-20251001"),
        actor_id=user.id,
    )
    unknown = await endpoints.add_model(
        session,
        provider=provider,
        payload=LLMModelCreate(model_id="some-model-nobody-prices"),
        actor_id=user.id,
    )

    # $1/Mtok in, so cheap on both orderings; the unpriced one is the middle,
    # which is what *neither cheap nor capable* looks like.
    assert (priced.capabilities["cost_rank"], priced.capabilities["power_rank"]) == (1, 1)
    assert (unknown.capabilities["cost_rank"], unknown.capabilities["power_rank"]) == (50, 50)


async def test_a_graph_on_a_negotiated_rate_keeps_the_ranks_it_states(
    session: AsyncSession, graph: Graph, user
) -> None:
    """PM12 — they are editable per row, so a stated rank is never derived over."""
    provider = await _offer(session, graph, "anthropic-prod", LLMProviderKind.anthropic)

    model = await endpoints.add_model(
        session,
        provider=provider,
        payload=LLMModelCreate(
            model_id="claude-opus-4-1",
            capabilities={"cost_rank": 3, "power_rank": 90},
        ),
        actor_id=user.id,
    )

    assert (model.capabilities["cost_rank"], model.capabilities["power_rank"]) == (3, 90)
